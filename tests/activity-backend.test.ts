import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi, type ApiFromModules } from 'convex/server';
import schema from '../convex/schema';
import type * as activity from '../convex/activity';
import type * as sync from '../convex/sync';
import { ACTIVITY_LIMIT, CLOUD_RETENTION_MS } from '../packages/shared';
const policy = vi.hoisted(() => ({ approved: false }));
vi.mock('../packages/shared/activity-policy', () => ({
  cloudActivityPolicyApproved: () => policy.approved,
}));
const api = anyApi as unknown as ApiFromModules<{
  activity: typeof activity;
  sync: typeof sync;
}>;
const modules = {
  '../convex/_generated/server.ts': () => import('../convex/_generated/server'),
  '../convex/activity.ts': () => import('../convex/activity'),
  '../convex/sync.ts': () => import('../convex/sync'),
};
const id = '11111111-1111-4111-8111-111111111111';
const event = {
  installationId: id,
  serviceId: null,
  action: 'FILL',
  result: 'FILLED',
  reason: 'none',
  time: Date.now(),
} as const;
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
    otherIssuer: t.withIdentity({
      subject: 'alice',
      issuer: 'https://other.fixture.invalid',
    }),
  };
}
afterEach(() => {
  policy.approved = false;
  vi.useRealTimers();
});
describe('actual activity functions and strict schema, offline runtime', () => {
  it('all public endpoints reject anonymous and owner arguments', async () => {
    const { t, alice } = setup();
    for (const run of [
      () => t.mutation(api.activity.append, { event }),
      () => t.mutation(api.activity.setCloudHistory, { enabled: false }),
      () => t.query(api.activity.exportHistory, {}),
      () => t.mutation(api.activity.deleteHistory, {}),
      () => t.mutation(api.activity.prune, {}),
    ])
      await expect(run()).rejects.toThrow('AUTH_REQUIRED');
    await expect(
      alice.query(api.activity.exportHistory, { owner: 'bob' } as never),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.activity.deleteHistory, { owner: 'bob' } as never),
    ).rejects.toThrow();
  });
  it('production policy refuses opt-in and append even for the registered owner', async () => {
    const { alice } = setup();
    await alice.mutation(api.sync.registerInstallation, {
      report: { installationId: id, providerStatus: 'DISCONNECTED' },
    });
    await expect(
      alice.mutation(api.activity.setCloudHistory, { enabled: true }),
    ).rejects.toThrow('POLICY_UNRESOLVED');
    await expect(
      alice.mutation(api.activity.append, { event }),
    ).rejects.toThrow('POLICY_UNRESOLVED');
    expect(await alice.query(api.activity.exportHistory, {})).toEqual([]);
  });
  it('hypothetical approved delivery still requires consent and installation ownership; deletion stops late append', async () => {
    policy.approved = true;
    const { alice, bob, otherIssuer } = setup();
    await alice.mutation(api.sync.registerInstallation, {
      report: { installationId: id, providerStatus: 'DISCONNECTED' },
    });
    await expect(
      alice.mutation(api.activity.append, { event }),
    ).rejects.toThrow('HISTORY_OFF');
    for (const actor of [bob, otherIssuer]) {
      await actor.mutation(api.activity.setCloudHistory, { enabled: true });
      await expect(
        actor.mutation(api.activity.append, { event }),
      ).rejects.toThrow('INSTALLATION_UNAVAILABLE');
    }
    await alice.mutation(api.activity.setCloudHistory, { enabled: true });
    await alice.mutation(api.activity.append, { event });
    expect(await alice.query(api.activity.exportHistory, {})).toEqual([event]);
    expect(await bob.query(api.activity.exportHistory, {})).toEqual([]);
    expect(await otherIssuer.query(api.activity.exportHistory, {})).toEqual([]);
    await bob.mutation(api.activity.deleteHistory, {});
    expect(await alice.query(api.activity.exportHistory, {})).toEqual([event]);
    await alice.mutation(api.activity.deleteHistory, {});
    expect(await alice.query(api.activity.exportHistory, {})).toEqual([]);
    await expect(
      alice.mutation(api.activity.append, { event }),
    ).rejects.toThrow('HISTORY_OFF');
  });
  it('rejects forbidden extra fields in requests and storage, and unshipped service/time/enums', async () => {
    policy.approved = true;
    const { t, alice } = setup();
    await alice.mutation(api.sync.registerInstallation, {
      report: { installationId: id, providerStatus: 'DISCONNECTED' },
    });
    await alice.mutation(api.activity.setCloudHistory, { enabled: true });
    for (const key of [
      'hostname',
      'messageId',
      'url',
      'otpHash',
      'otp',
      'mailboxId',
      'token',
      'freeform',
      'owner',
    ]) {
      const forbidden = { ...event, [key]: 'synthetic' };
      await expect(
        alice.mutation(api.activity.append, { event: forbidden } as never),
      ).rejects.toThrow();
      await expect(
        t.run((ctx) =>
          ctx.db.insert('activity', {
            owner: 'synthetic',
            event: forbidden,
          } as never),
        ),
      ).rejects.toThrow();
    }
    for (const change of [
      { serviceId: 'github' },
      { serviceId: 'https://site.fixture.invalid' },
      { time: -1 },
      { time: Date.now() + 60_000 },
      { time: 0 },
      { time: 1.5 },
      { reason: 'freeform' },
      { result: 'SUCCESS' },
    ])
      await expect(
        alice.mutation(api.activity.append, {
          event: { ...event, ...change },
        } as never),
      ).rejects.toThrow();
  });
  it('hides and physically prunes expiry, protects foreign records and bounds history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(event.time);
    policy.approved = true;
    const { t, alice, bob } = setup();
    await alice.mutation(api.sync.registerInstallation, {
      report: { installationId: id, providerStatus: 'DISCONNECTED' },
    });
    await alice.mutation(api.activity.setCloudHistory, { enabled: true });
    await t.run(async (ctx) => {
      await ctx.db.insert('activity', {
        owner: 'https://auth.fixture.invalid|bob',
        event,
      });
      for (let n = 0; n < ACTIVITY_LIMIT; n++)
        await ctx.db.insert('activity', {
          owner: 'https://auth.fixture.invalid|alice',
          event: { ...event, time: event.time - n },
        });
    });
    await alice.mutation(api.activity.append, { event });
    expect(await alice.query(api.activity.exportHistory, {})).toHaveLength(
      ACTIVITY_LIMIT,
    );
    await alice.mutation(api.activity.setCloudHistory, { enabled: false });
    expect(await bob.query(api.activity.exportHistory, {})).toEqual([event]);
    vi.setSystemTime(event.time + CLOUD_RETENTION_MS);
    expect(await bob.query(api.activity.exportHistory, {})).toEqual([]);
    await alice.mutation(api.activity.prune, {});
    expect(
      await t.run((ctx) => ctx.db.query('activity').collect()),
    ).toHaveLength(1);
    await t.mutation(api.activity.expire, {});
    expect(await t.run((ctx) => ctx.db.query('activity').collect())).toEqual(
      [],
    );
  });
  it('scheduled cleanup continues in bounded batches for inactive owners', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(event.time + CLOUD_RETENTION_MS);
    const { t } = setup();
    await t.run(async (ctx) => {
      for (let n = 0; n < 101; n++)
        await ctx.db.insert('activity', {
          owner: 'inactive-synthetic-owner',
          event,
        });
    });
    await t.mutation(api.activity.expire, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query('activity').collect())).toEqual(
      [],
    );
  });
});
