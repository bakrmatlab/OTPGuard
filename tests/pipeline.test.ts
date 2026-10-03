import { describe, expect, it } from 'vitest';
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
