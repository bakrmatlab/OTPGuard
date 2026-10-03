import { createAccountGate } from '../apps/extension/account/gate';
import { createLocalSettings } from '../apps/extension/settings/local';
import { createSettingsSync } from '../apps/extension/settings/sync';
import { convexTest } from 'convex-test';
import {
  anyApi,
  type ApiFromModules,
  type FilterApi,
  type FunctionReference,
} from 'convex/server';
import { describe, expect, it, vi, afterEach } from 'vitest';
import schema from '../convex/schema';
import type * as sync from '../convex/sync';
import { providerReportLabel } from '../packages/shared';
const api = anyApi as unknown as FilterApi<
  ApiFromModules<{ sync: typeof sync }>,
  FunctionReference<'query' | 'mutation', 'public'>
>;
const modules = {
  '../convex/_generated/server.ts': () => import('../convex/_generated/server'),
  '../convex/sync.ts': () => import('../convex/sync'),
};
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const report = { installationId: id, providerStatus: 'CONNECTED' as const };
function setup() {
  const t = convexTest(schema, modules);
  return {
    t,
    alice: t.withIdentity({
      subject: 'alice',
      issuer: 'https://auth.fixture.invalid',
    }),
    bob: t.withIdentity({
      subject: 'bob',
      issuer: 'https://auth.fixture.invalid',
    }),
  };
}
afterEach(() => vi.useRealTimers());
describe('actual Convex functions, schema and ownership', () => {
  it('rejects anonymous access to every endpoint', async () => {
    const { t } = setup();
    for (const operation of [
      () => t.query(api.sync.readSettings, {}),
      () =>
        t.mutation(api.sync.writeSettings, {
          settings: { autofillEnabled: true },
        }),
      () => t.mutation(api.sync.registerInstallation, { report }),
      () => t.mutation(api.sync.reportProvider, { report }),
      () => t.query(api.sync.readInstallation, { installationId: id }),
      () => t.query(api.sync.listInstallations, {}),
    ])
      await expect(operation()).rejects.toThrow('AUTH_REQUIRED');
  });
  it('round-trips settings per validated identity and never accepts a caller owner', async () => {
    const { alice, bob } = setup();
    await alice.mutation(api.sync.writeSettings, {
      settings: { autofillEnabled: true },
    });
    expect(await alice.query(api.sync.readSettings, {})).toEqual({
      autofillEnabled: true,
    });
    expect(await bob.query(api.sync.readSettings, {})).toEqual({
      autofillEnabled: false,
    });
    await bob.mutation(api.sync.writeSettings, {
      settings: { autofillEnabled: false },
    });
    expect(await alice.query(api.sync.readSettings, {})).toEqual({
      autofillEnabled: true,
    });
    for (const forged of [{ owner: 'alice' }, { userId: 'alice' }]) {
      await expect(
        bob.query(api.sync.readSettings, forged as never),
      ).rejects.toThrow();
      await expect(
        bob.mutation(api.sync.writeSettings, {
          ...forged,
          settings: { autofillEnabled: false },
        } as never),
      ).rejects.toThrow();
    }
  });
  it('isolates the same subject under different issuers', async () => {
    const { t, alice } = setup();
    await alice.mutation(api.sync.writeSettings, {
      settings: { autofillEnabled: true },
    });
    const otherIssuer = t.withIdentity({
      subject: 'alice',
      issuer: 'https://other.fixture.invalid',
    });
    expect(await otherIssuer.query(api.sync.readSettings, {})).toEqual({
      autofillEnabled: false,
    });
  });
  it('rejects foreign installation reads, reports and takeover registrations', async () => {
    const { alice, bob } = setup();
    await alice.mutation(api.sync.registerInstallation, { report });
    for (const operation of [
      () => bob.query(api.sync.readInstallation, { installationId: id }),
      () => bob.mutation(api.sync.reportProvider, { report }),
      () => bob.mutation(api.sync.registerInstallation, { report }),
    ])
      await expect(operation()).rejects.toThrow('INSTALLATION_UNAVAILABLE');
    expect(await bob.query(api.sync.listInstallations, {})).toEqual([]);
    expect(await alice.query(api.sync.listInstallations, {})).toHaveLength(1);
    await expect(
      bob.mutation(api.sync.registerInstallation, {
        report: { ...report, owner: 'alice' },
      } as never),
    ).rejects.toThrow();
  });
  it('uses server report time and keeps registration idempotent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { alice } = setup();
    await alice.mutation(api.sync.registerInstallation, { report });
    await alice.mutation(api.sync.registerInstallation, { report });
    expect(await alice.query(api.sync.listInstallations, {})).toEqual([
      { ...report, lastSeenAt: 100_000 },
    ]);
    vi.setSystemTime(120_000);
    await alice.mutation(api.sync.reportProvider, {
      report: { ...report, providerStatus: 'RECONNECT_REQUIRED' },
    });
    const record = await alice.query(api.sync.readInstallation, {
      installationId: id,
    });
    expect(record).toEqual({
      ...report,
      providerStatus: 'RECONNECT_REQUIRED',
      lastSeenAt: 120_000,
    });
    expect(providerReportLabel(record, 419_999)).toContain(
      'current Gmail connection unverified',
    );
    expect(providerReportLabel(record, 420_000)).toContain('Stale');
    expect(providerReportLabel(record, 119_999)).toContain('time unavailable');
  });
  it('rejects unknown IDs and malformed installation IDs', async () => {
    const { alice } = setup();
    await expect(
      alice.mutation(api.sync.reportProvider, { report }),
    ).rejects.toThrow('INSTALLATION_UNAVAILABLE');
    for (const installationId of [
      'mailbox@fixture.invalid',
      'https://site.fixture.invalid/login',
      'hardware-serial',
      id.toUpperCase() + 'x',
    ])
      await expect(
        alice.mutation(api.sync.registerInstallation, {
          report: { ...report, installationId },
        }),
      ).rejects.toThrow('INVALID_INSTALLATION');
    await alice.mutation(api.sync.registerInstallation, {
      report: { ...report, installationId: otherId },
    });
  });
  it('rejects sensitive and policy-expanding payload fields at actual validators', async () => {
    const { alice } = setup();
    for (const forbidden of [
      'otp',
      'emailBody',
      'subject',
      'mailboxId',
      'gmailToken',
      'url',
      'trustedDomains',
      'securityEnabled',
      'cloudHistory',
      'lastSeenAt',
    ]) {
      const extra = { [forbidden]: 'synthetic-forbidden' };
      await expect(
        alice.mutation(api.sync.writeSettings, {
          settings: { autofillEnabled: true, ...extra },
        } as never),
      ).rejects.toThrow();
      await expect(
        alice.mutation(api.sync.registerInstallation, {
          report: { ...report, ...extra },
        } as never),
      ).rejects.toThrow();
    }
    await expect(
      alice.mutation(api.sync.registerInstallation, {
        report: { ...report, providerStatus: 'TOKEN_VALID' },
      } as never),
    ).rejects.toThrow();
  });
  it('bounds installation creation and exposes only closed metadata', async () => {
    const { alice, t } = setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++)
        await ctx.db.insert('installations', {
          owner: 'https://auth.fixture.invalid|alice',
          installationId: `${i.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`,
          providerStatus: 'DISCONNECTED',
          lastSeenAt: 1,
        });
    });
    await expect(
      alice.mutation(api.sync.registerInstallation, { report }),
    ).rejects.toThrow('INSTALLATION_LIMIT');
    expect(await alice.query(api.sync.listInstallations, {})).toHaveLength(100);
  });
});

it('schema rejects forbidden persistent fields, not just endpoint arguments', async () => {
  const { t } = setup();
  await expect(
    t.run((ctx) =>
      ctx.db.insert('settings', {
        owner: 'synthetic-owner',
        value: { autofillEnabled: true },
        otp: 'synthetic',
      } as never),
    ),
  ).rejects.toThrow();
  await expect(
    t.run((ctx) =>
      ctx.db.insert('installations', {
        owner: 'synthetic-owner',
        ...report,
        lastSeenAt: 1,
        mailboxId: 'synthetic',
      } as never),
    ),
  ).rejects.toThrow();
});

it('connects the controller to actual account-scoped functions with a fresh bound transport', async () => {
  const { alice, bob } = setup();
  let identity = {
    userId: 'alice',
    sessionId: 'alice-session',
    expiresAt: Date.now() + 60_000,
    label: 'Synthetic',
  };
  const account = createAccountGate(async () => identity);
  const local = createLocalSettings(
    { read: async () => undefined, write: async () => {} },
    () => id,
  );
  await local.initialized;
  await local.setAutofill(true);
  const bindings: string[] = [];
  const controller = createSettingsSync(local, account, async (binding) => {
    bindings.push(`${binding.userId}/${binding.sessionId}`);
    const actor = binding.userId === 'alice' ? alice : bob;
    return {
      readSettings: async () => actor.query(api.sync.readSettings, {}),
      writeSettings: async (settings) => {
        await actor.mutation(api.sync.writeSettings, { settings });
      },
      registerInstallation: async (report) => {
        await actor.mutation(api.sync.registerInstallation, { report });
      },
    };
  });
  try {
    controller.enable(true);
    await controller.synchronize('CONNECTED', 'push');
    expect(controller.status()).toBe('SYNCED');
    expect(await alice.query(api.sync.readSettings, {})).toEqual({
      autofillEnabled: true,
    });
    expect(await bob.query(api.sync.readSettings, {})).toEqual({
      autofillEnabled: false,
    });
    expect(await alice.query(api.sync.listInstallations, {})).toHaveLength(1);
    identity = { ...identity, userId: 'bob', sessionId: 'bob-session' };
    account.invalidate();
    await controller.synchronize('DISCONNECTED', 'push');
    // Switching accounts cannot transfer the existing installation or write Alice's settings.
    expect(controller.status()).toBe('UNAVAILABLE');
    expect(await bob.query(api.sync.listInstallations, {})).toEqual([]);
    expect(bindings).toEqual(['alice/alice-session', 'bob/bob-session']);
    expect(controller.settings().autofillEnabled).toBe(true);
  } finally {
    controller.dispose();
    account.invalidate();
  }
});
