import { afterEach, expect, it, vi } from 'vitest';
import {
  createAccountGate,
  type AccountIdentity,
} from '../apps/extension/account/gate';
import {
  createGmailLifecycle,
  type GmailAdapter,
} from '../apps/extension/gmail/lifecycle';
import { createAuthenticatedMailbox } from '../apps/extension/gmail/authenticated';
import { GMAIL_SCOPE } from '../apps/extension/gmail/config';
import type { RememberedMailboxStore } from '../apps/extension/gmail/remembered';
const gates: ReturnType<typeof createAccountGate>[] = [];
afterEach(() => {
  for (const gate of gates.splice(0)) gate.invalidate();
});
function setup() {
  let identity: AccountIdentity | null = {
    userId: 'owner',
    sessionId: 'session',
    label: 'Synthetic',
    expiresAt: Date.now() + 120000,
  };
  let stored: unknown;
  const store: RememberedMailboxStore = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (v) => {
      stored = v;
    }),
    remove: vi.fn(async () => {
      stored = undefined;
    }),
  };
  const adapter: GmailAdapter = {
    token: vi.fn(async () => ({
      token: 'synthetic-secret',
      grantedScopes: [GMAIL_SCOPE],
    })),
    profile: vi.fn(async () => 'owner@fixture.invalid'),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    revoke: vi.fn(async () => true),
  };
  const account = createAccountGate(async () => identity);
  gates.push(account);
  const restart = () => {
    const lifecycle = createGmailLifecycle(adapter, true);
    return {
      lifecycle,
      mailbox: createAuthenticatedMailbox(account, lifecycle, store),
    };
  };
  return {
    ...restart(),
    account,
    adapter,
    store,
    restart,
    stored: () => stored,
    select: (next: AccountIdentity | null) => {
      identity = next;
      account.invalidate();
    },
  };
}
it('restores a prior explicit same-session mailbox after restart without interactive consent or secret persistence', async () => {
  const t = setup();
  expect((await t.mailbox.check()).state).toBe('DISCONNECTED');
  expect(t.adapter.token).not.toHaveBeenCalled();
  expect((await t.mailbox.connect()).state).toBe('CONNECTED');
  expect(JSON.stringify(t.stored())).not.toMatch(
    /owner@|synthetic-secret|"session"/,
  );
  vi.mocked(t.adapter.token).mockClear();
  const restarted = t.restart();
  const results = await Promise.all([
    restarted.mailbox.check(),
    restarted.mailbox.check(),
  ]);
  expect(results.map((r) => r.state)).toEqual(['CONNECTED', 'CONNECTED']);
  expect(t.adapter.token).toHaveBeenCalledExactlyOnceWith(false);
});
it.each(['account', 'session', 'signed-out', 'mailbox', 'revoked'] as const)(
  'refuses remembered restoration after %s changes',
  async (change) => {
    const t = setup();
    await t.mailbox.connect();
    vi.mocked(t.adapter.token).mockClear();
    if (change === 'account' || change === 'session')
      t.select({
        userId: change === 'account' ? 'other' : 'owner',
        sessionId: 'other-session',
        label: 'Other',
        expiresAt: Date.now() + 120000,
      });
    if (change === 'signed-out') t.select(null);
    if (change === 'mailbox')
      vi.mocked(t.adapter.profile).mockResolvedValue('other@fixture.invalid');
    if (change === 'revoked')
      vi.mocked(t.adapter.token).mockRejectedValue(
        new Error('synthetic denied'),
      );
    const restarted = t.restart();
    expect((await restarted.mailbox.check()).state).not.toBe('CONNECTED');
    expect(restarted.lifecycle.snapshot().state).not.toBe('CONNECTED');
    expect(t.adapter.token).not.toHaveBeenCalledWith(true);
    if (['account', 'session', 'signed-out'].includes(change))
      expect(t.adapter.token).not.toHaveBeenCalled();
  },
);
it('disconnect removes remembered authority before cleanup and a restart cannot reconnect', async () => {
  const t = setup();
  await t.mailbox.connect();
  await t.mailbox.disconnect();
  expect(t.stored()).toBeUndefined();
  vi.mocked(t.adapter.token).mockClear();
  expect((await t.restart().mailbox.check()).state).toBe('DISCONNECTED');
  expect(t.adapter.token).not.toHaveBeenCalled();
});
it('does not publish CONNECTED while restored mailbox validation is pending or after logout', async () => {
  const t = setup();
  await t.mailbox.connect();
  let finish!: (v: string) => void;
  vi.mocked(t.adapter.profile).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const restarted = t.restart();
  const pending = restarted.mailbox.check();
  await vi.waitFor(() => expect(finish).toBeDefined());
  expect(restarted.lifecycle.snapshot().state).not.toBe('CONNECTED');
  t.select(null);
  finish('owner@fixture.invalid');
  expect((await pending).state).not.toBe('CONNECTED');
  expect(restarted.lifecycle.snapshot().state).not.toBe('CONNECTED');
});
it('corrupt or unreadable remembered data never probes a cached grant', async () => {
  const t = setup();
  vi.mocked(t.store.read).mockResolvedValueOnce({
    version: 1,
    ownerDigest: 'bad',
    mailboxDigest: 'bad',
  });
  expect((await t.restart().mailbox.check()).state).not.toBe('CONNECTED');
  vi.mocked(t.store.read).mockRejectedValueOnce(
    new Error('storage unavailable'),
  );
  expect((await t.restart().mailbox.check()).state).not.toBe('CONNECTED');
  expect(t.adapter.token).not.toHaveBeenCalled();
});

it('restores before admitting an automatic page request through the connected coordinator', async () => {
  const { createMailboxCoordinator } =
    await import('../apps/extension/gmail/connected');
  const t = setup();
  await t.mailbox.connect();
  const restarted = t.restart();
  vi.mocked(t.adapter.token).mockClear();
  const retrieve = vi.fn(async () => []);
  const context = {
    accountId: '',
    mailboxId: 'owner@fixture.invalid',
    tabId: 1,
    documentId: 'doc',
    origin: 'https://fixture.invalid',
    browserUrl: 'https://fixture.invalid/',
    policyUrl: 'https://fixture.invalid/',
    serviceId: 'synthetic',
    foreground: true,
  };
  const coordinator = createMailboxCoordinator(
    {
      registry: [],
      now: Date.now,
      id: () => 'request',
      context: async () => context,
      current: async () => true,
      retrieve,
      send: async () => true,
    },
    t.account,
    restarted.lifecycle,
    () => restarted.mailbox.check(),
  );
  try {
    expect(
      (
        await coordinator.handle(
          {
            type: 'detect',
            groupId: 'fields',
            expectedLength: 6,
            emailFlow: true,
            groupCount: 1,
          },
          {},
        )
      ).state,
    ).toBe('NO_CODE');
    expect(retrieve).toHaveBeenCalledOnce();
    expect(t.adapter.token).not.toHaveBeenCalledWith(true);
  } finally {
    coordinator.dispose();
  }
});
it('Disconnect cancels a pending saved-binding write and removes it before returning', async () => {
  const t = setup();
  let finish!: () => void;
  const write = t.store.write;
  vi.mocked(t.store.write).mockImplementationOnce(async (v) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await write(v);
  });
  const connecting = t.mailbox.connect();
  await vi.waitFor(() => expect(finish).toBeDefined());
  const disconnecting = t.mailbox.disconnect();
  finish();
  expect((await connecting).state).not.toBe('CONNECTED');
  await disconnecting;
  expect(t.stored()).toBeUndefined();
});
it('failed remembered-intent removal cannot report a successful Disconnect or revoke a provider grant', async () => {
  const t = setup();
  await t.mailbox.connect();
  vi.mocked(t.store.remove).mockRejectedValueOnce(
    new Error('synthetic storage unavailable'),
  );
  await expect(t.mailbox.disconnect()).rejects.toThrow();
  expect(t.lifecycle.snapshot().state).not.toBe('CONNECTED');
  expect(t.adapter.revoke).not.toHaveBeenCalled();
});
