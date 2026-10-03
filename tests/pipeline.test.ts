import { describe, expect, it, vi } from 'vitest';
import { createLocalSettings } from '../apps/extension/settings/local';
import { createSettingsSync } from '../apps/extension/settings/sync';
import { createAccountGate } from '../apps/extension/account/gate';
import {
  createCoordinator,
  type Adapter,
  type Context,
  type Envelope,
} from '../apps/extension/pipeline/coordinator';
import { parseClient, parseWorker } from '../apps/extension/pipeline/protocol';
import type { ServicePolicy } from '../packages/security';
const policy: ServicePolicy = {
  id: 'mock',
  name: 'Synthetic',
  origins: ['https://lantern.example'],
  senders: [
    {
      address: 'code@lantern.example',
      authenticatedDomain: 'lantern.example',
      boundaryId: 'test',
      method: 'aligned-dkim',
    },
  ],
  templates: ['inline'],
  purposes: ['sign-in'],
  codeLengths: [6],
  maxAgeMs: 300_000,
  provenance: 'synthetic',
  validatedOn: '2026-10-03',
};
const detect = {
  type: 'detect',
  groupId: 'fields-1',
  expectedLength: 6,
  emailFlow: true,
  groupCount: 1,
};
function setup() {
  let now = 100_000;
  let valid = true;
  const context: Context = {
    accountId: 'account',
    mailboxId: 'mailbox',
    tabId: 1,
    documentId: 'document',
    origin: 'https://lantern.example',
    browserUrl: 'https://lantern.example/login',
    policyUrl: 'https://lantern.example/login',
    serviceId: 'mock',
    foreground: true,
  };
  const envelope: Envelope = {
    messageId: 'message',
    mailboxId: 'mailbox',
    receivedAt: now,
    sender: {
      status: 'authenticated',
      messageId: 'message',
      mailboxId: 'mailbox',
      address: 'code@lantern.example',
      authenticatedDomain: 'lantern.example',
      boundaryId: 'test',
      method: 'aligned-dkim',
      delivery: 'direct',
    },
    email: { subject: 'Sign in', text: 'Your verification code is 042681' },
  };
  const sends: string[] = [];
  let id = 0;
  const adapter: Adapter = {
    registry: [policy],
    now: () => now,
    id: () => `request-${++id}`,
    context: async () => ({ ...context }),
    current: async (bound) =>
      valid &&
      bound.accountId === context.accountId &&
      bound.mailboxId === context.mailboxId &&
      context.foreground,
    retrieve: async () => [envelope],
    send: async (_, message) => {
      sends.push(message.type);
      return true;
    },
  };
  const coordinator = createCoordinator(adapter);
  return {
    adapter,
    context,
    envelope,
    coordinator,
    sends,
    invalidate: () => {
      valid = false;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe('closed protocol', () => {
  it('rejects claimed trust, origins, account IDs, invalid lengths and malformed release', () => {
    expect(parseClient(detect)).toEqual(detect);
    for (const extra of [
      { origin: 'https://lantern.example' },
      { accountId: 'account' },
      { sender: { status: 'authenticated' } },
      { expectedLength: 3 },
      { groupCount: 0 },
      { groupId: '../bad' },
    ])
      expect(parseClient({ ...detect, ...extra })).toBeNull();
    expect(parseClient(null)).toBeNull();
    expect(
      parseWorker({
        type: 'release',
        requestId: 'r',
        groupId: 'g',
        expectedLength: 6,
        expiresAt: 100,
        code: '1234',
      }),
    ).toBeNull();
  });
});
describe('worker authorization boundary', () => {
  it('safe synthetic envelope fills once; status contains no code', async () => {
    const s = setup();
    expect(await s.coordinator.handle(detect, {})).toEqual({ state: 'FILLED' });
    expect(s.sends).toEqual(['prepare', 'release']);
    expect(JSON.stringify(s.coordinator.status())).not.toContain('042681');
    await s.coordinator.handle(detect, {});
    expect(s.sends).toHaveLength(2);
  });
  it.each([
    'destination',
    'sender',
    'binding',
    'text',
    'receipt',
    'ambiguous',
    'incomplete',
    'groups',
    'background',
    'uncertain',
    'untrusted-runtime',
  ] as const)('refuses %s without releasing', async (scenario) => {
    const s = setup();
    const request = { ...detect };
    if (scenario === 'destination')
      s.context.policyUrl = 'https://unrelated.example';
    if (scenario === 'sender') s.envelope.sender = { status: 'unknown' };
    if (scenario === 'binding' && s.envelope.sender.status === 'authenticated')
      s.envelope.sender.messageId = 'different';
    if (scenario === 'text') s.envelope.email.text = 'Order number 042681';
    if (scenario === 'receipt') s.envelope.receivedAt = 1;
    if (scenario === 'ambiguous')
      s.adapter.retrieve = async () => [
        s.envelope,
        { ...s.envelope, messageId: 'second' },
      ];
    if (scenario === 'incomplete') s.adapter.retrieve = async () => null;
    if (scenario === 'groups') request.groupCount = 2;
    if (scenario === 'background') s.context.foreground = false;
    if (scenario === 'uncertain') request.emailFlow = false;
    if (scenario === 'untrusted-runtime') s.adapter.context = async () => null;
    expect((await s.coordinator.handle(request, {})).state).not.toBe('FILLED');
    expect(s.sends).toEqual([]);
  });
  it.each([
    'navigation',
    'account',
    'mailbox',
    'focus',
    'deadline',
    'approval-expiry',
    'fields',
  ] as const)('rechecks %s after prepare', async (scenario) => {
    const s = setup();
    s.adapter.send = async (_, message) => {
      s.sends.push(message.type);
      if (scenario === 'deadline') s.advance(60_000);
      else if (scenario === 'approval-expiry') s.advance(30_000);
      else if (scenario === 'fields') return false;
      else if (scenario === 'account') s.context.accountId = 'other-account';
      else if (scenario === 'mailbox') s.context.mailboxId = 'other-mailbox';
      else if (scenario === 'focus') s.context.foreground = false;
      else s.invalidate();
      return true;
    };
    expect((await s.coordinator.handle(detect, {})).state).toBe('CANCELLED');
    expect(s.sends).toEqual(['prepare']);
  });
  it('latches competing same-service requests even when one cancels', async () => {
    const s = setup();
    const resolvers: ((messages: readonly Envelope[]) => void)[] = [];
    s.adapter.retrieve = () =>
      new Promise((resolve) => resolvers.push(resolve));
    const first = s.coordinator.handle(detect, {});
    await Promise.resolve();
    await Promise.resolve();
    s.context.tabId = 2;
    const second = s.coordinator.handle({ ...detect, groupId: 'fields-2' }, {});
    await Promise.resolve();
    await Promise.resolve();
    s.coordinator.cancelTab(2);
    for (const resolve of resolvers) resolve([s.envelope]);
    await Promise.all([first, second]);
    expect(s.sends).toEqual([]);
  });
  it('cancellation during an asynchronous browser recheck cannot release', async () => {
    const s = setup();
    let finish!: (current: boolean) => void;
    s.adapter.current = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = s.coordinator.handle(detect, {});
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    s.coordinator.cancelAll();
    finish(true);
    await pending;
    expect(s.sends).toEqual([]);
  });
  it('cancellation and a fresh worker cannot release an old pending request', async () => {
    const s = setup();
    let finish!: (messages: readonly Envelope[]) => void;
    s.adapter.retrieve = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = s.coordinator.handle(detect, {});
    await Promise.resolve();
    await Promise.resolve();
    s.coordinator.cancelAll();
    const restarted = createCoordinator(s.adapter);
    expect(restarted.status()).toEqual({ state: 'IDLE' });
    finish([s.envelope]);
    await pending;
    expect(s.sends).toEqual([]);
  });
});

describe('connected account release boundary', () => {
  it('preserves a valid authorized fill and rejects switching away and back during prepare', async () => {
    const { createAccountGate } =
      await import('../apps/extension/account/gate');
    const { createConnectedCoordinator } =
      await import('../apps/extension/account/connected');
    for (const switchAccount of [false, true]) {
      const fixture = setup();
      const gate = createAccountGate(
        async () => ({
          userId: fixture.context.accountId,
          sessionId: 'synthetic-session',
          expiresAt: fixture.adapter.now() + 30_000,
          label: 'Synthetic',
        }),
        fixture.adapter.now,
      );
      const originalSend = fixture.adapter.send;
      fixture.adapter.send = async (context, message) => {
        if (switchAccount && message.type === 'prepare') {
          fixture.context.accountId = 'other';
          await gate.refresh();
          fixture.context.accountId = 'account';
          await gate.refresh();
        }
        return originalSend(context, message);
      };
      const coordinator = createConnectedCoordinator(fixture.adapter, gate);
      const status = await coordinator.handle(detect, {});
      expect(status.state).toBe(switchAccount ? 'CANCELLED' : 'FILLED');
      expect(fixture.sends).toEqual(
        switchAccount ? ['prepare'] : ['prepare', 'release'],
      );
      coordinator.dispose();
      gate.invalidate();
    }
  });
});

it('bounded polling hands synthetic success to authorization and retains mismatch/stale/ambiguity refusal', async () => {
  const { createRetrievalEngine } =
    await import('../apps/extension/gmail/retrieval');
  for (const scenario of ['safe', 'mismatch', 'stale', 'ambiguous']) {
    const test = setup();
    if (scenario === 'mismatch')
      test.context.policyUrl = 'https://unrelated.example';
    if (scenario === 'stale') test.envelope.receivedAt = 1;
    const engine = createRetrievalEngine({
      now: test.adapter.now,
      current: test.adapter.current,
      cycle: async () =>
        scenario === 'ambiguous'
          ? [test.envelope, { ...test.envelope, messageId: 'second' }]
          : [test.envelope],
    });
    const coordinator = createCoordinator({
      ...test.adapter,
      retrieve: engine.retrieve,
    });
    expect((await coordinator.handle(detect, {})).state).toBe(
      scenario === 'safe'
        ? 'FILLED'
        : scenario === 'mismatch'
          ? 'MISMATCH'
          : 'UNKNOWN',
    );
    expect(test.sends).toEqual(
      scenario === 'safe' ? ['prepare', 'release'] : [],
    );
    engine.cancelAll();
  }
});

describe('PR11 local settings at the actual authorization boundary', () => {
  it('explicit local block refuses before any retrieval', async () => {
    const f = setup();
    const retrieve = vi.fn(f.adapter.retrieve);
    const coordinator = createCoordinator({
      ...f.adapter,
      retrieve,
      settings: () => ({
        autofillEnabled: true,
        blockedOrigins: [f.context.origin],
      }),
    });
    expect(await coordinator.handle(detect, {})).toEqual({
      state: 'BLOCKED',
      reason: 'local-block',
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(f.sends).toEqual([]);
  });
  it('a local block added during prepare prevents release despite enabling sync preference', async () => {
    const f = setup();
    let blockedOrigins: string[] = [];
    const coordinator = createCoordinator({
      ...f.adapter,
      settings: () => ({ autofillEnabled: true, blockedOrigins }),
      send: async (context, message) => {
        const result = await f.adapter.send(context, message);
        if (message.type === 'prepare') blockedOrigins = [f.context.origin];
        return result;
      },
    });
    expect(await coordinator.handle(detect, {})).toEqual({
      state: 'BLOCKED',
      reason: 'local-block',
    });
    expect(f.sends).toEqual(['prepare']);
  });
  it('disabling automatic fill during prepare prevents release', async () => {
    const f = setup();
    let enabled = true;
    const coordinator = createCoordinator({
      ...f.adapter,
      settings: () => ({ autofillEnabled: enabled, blockedOrigins: [] }),
      send: async (context, message) => {
        const result = await f.adapter.send(context, message);
        enabled = false;
        return result;
      },
    });
    expect(await coordinator.handle(detect, {})).toEqual({
      state: 'CANCELLED',
    });
    expect(f.sends).toEqual(['prepare']);
  });
  it('stalled cloud sync does not delay a locally authorized synthetic fill', async () => {
    const f = setup();
    const local = createLocalSettings(
      { read: async () => undefined, write: async () => {} },
      () => '11111111-1111-4111-8111-111111111111',
    );
    await local.initialized;
    await local.setAutofill(true);
    const account = createAccountGate(async () => ({
      userId: 'account',
      sessionId: 'synthetic-session',
      expiresAt: Date.now() + 60_000,
      label: 'synthetic',
    }));
    let started!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const sync = createSettingsSync(local, account, async () => ({
      registerInstallation: async () => {},
      writeSettings: async () => {},
      readSettings: async () => {
        started();
        return new Promise(() => {});
      },
    }));
    sync.enable(true);
    const pending = sync.synchronize('CONNECTED');
    await readStarted;
    const coordinator = createCoordinator({
      ...f.adapter,
      settings: sync.settings,
    });
    expect(await coordinator.handle(detect, {})).toEqual({ state: 'FILLED' });
    expect(f.sends).toEqual(['prepare', 'release']);
    sync.dispose();
    account.invalidate();
    await pending;
  });
});

it('a saved local block aborts an ongoing retrieval immediately', async () => {
  const f = setup();
  const local = createLocalSettings(
    { read: async () => undefined, write: async () => {} },
    () => '11111111-1111-4111-8111-111111111111',
  );
  await local.initialized;
  await local.setAutofill(true);
  let started!: () => void;
  let aborted = false;
  const retrieving = new Promise<void>((resolve) => {
    started = resolve;
  });
  const coordinator = createCoordinator({
    ...f.adapter,
    settings: local.snapshot,
    subscribeSettings: local.subscribe,
    retrieve: async (_context, signal) => {
      started();
      return new Promise((resolve) =>
        signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            resolve(null);
          },
          { once: true },
        ),
      );
    },
  });
  const result = coordinator.handle(detect, {});
  await retrieving;
  await local.setBlock(f.context.origin, true);
  expect(aborted).toBe(true);
  expect(await result).toEqual({ state: 'CANCELLED' });
  expect(f.sends).toEqual([]);
  coordinator.dispose();
});
