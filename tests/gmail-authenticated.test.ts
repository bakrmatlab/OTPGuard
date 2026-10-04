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
const gates: ReturnType<typeof createAccountGate>[] = [];
afterEach(() => {
  for (const gate of gates.splice(0)) gate.invalidate();
});
function setup() {
  let identity: AccountIdentity | null = {
    userId: 'owner',
    sessionId: 'session',
    label: 'account@fixture.invalid',
    expiresAt: Date.now() + 60_000,
  };
  const account = createAccountGate(async () => identity);
  gates.push(account);
  const adapter: GmailAdapter = {
    token: vi.fn(async () => ({
      token: 'synthetic-token',
      grantedScopes: [GMAIL_SCOPE],
    })),
    profile: vi.fn(async () => 'different-mailbox@fixture.invalid'),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    revoke: vi.fn(async () => true),
  };
  const lifecycle = createGmailLifecycle(adapter, true);
  return {
    account,
    adapter,
    lifecycle,
    mailbox: createAuthenticatedMailbox(account, lifecycle),
    select: (next: AccountIdentity | null) => {
      identity = next;
      account.invalidate();
    },
  };
}
it('requires fresh Clerk authorization before consent; different Clerk and Gmail emails are valid', async () => {
  const s = setup();
  expect(await s.mailbox.check()).toEqual({ state: 'DISCONNECTED' });
  expect(s.adapter.token).not.toHaveBeenCalled();
  expect(await s.mailbox.connect()).toEqual({
    state: 'CONNECTED',
    mailbox: 'different-mailbox@fixture.invalid',
  });
  s.select(null);
  expect(await s.mailbox.check()).toEqual({ state: 'SIGN_IN_REQUIRED' });
  expect(await s.mailbox.connect()).toEqual({ state: 'SIGN_IN_REQUIRED' });
  expect(s.adapter.token).toHaveBeenCalledOnce();
  expect((await s.mailbox.disconnect()).state).toBe('DISCONNECTED');
});
it('a switched Clerk session cannot inherit a connected mailbox; explicit disconnect is required', async () => {
  const s = setup();
  await s.mailbox.connect();
  s.select({
    userId: 'other',
    sessionId: 'other-session',
    label: 'Other',
    expiresAt: Date.now() + 60_000,
  });
  expect(await s.mailbox.check()).toEqual({ state: 'ACCOUNT_CHANGED' });
  expect(await s.mailbox.connect()).toEqual({ state: 'ACCOUNT_CHANGED' });
  expect(s.adapter.token).toHaveBeenCalledOnce();
  await s.mailbox.disconnect();
  expect((await s.mailbox.connect()).state).toBe('CONNECTED');
});
it('logout during Google consent discards the delayed grant and never reports connected', async () => {
  const s = setup();
  let finish!: (value: { token: string; grantedScopes: string[] }) => void;
  vi.mocked(s.adapter.token).mockImplementationOnce(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  const pending = s.mailbox.connect();
  for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
  s.select(null);
  finish({ token: 'delayed-synthetic', grantedScopes: [GMAIL_SCOPE] });
  expect(await pending).toEqual({ state: 'SIGN_IN_REQUIRED' });
  expect(s.adapter.profile).not.toHaveBeenCalled();
  expect(s.adapter.remove).toHaveBeenCalledWith('delayed-synthetic');
});
it('a fresh worker never restores cached Gmail consent automatically or revokes an unbound account', async () => {
  const s = setup();
  await s.mailbox.connect();
  const restarted = createAuthenticatedMailbox(
    s.account,
    createGmailLifecycle(s.adapter, true),
  );
  vi.mocked(s.adapter.token).mockClear();
  expect(await restarted.check()).toEqual({ state: 'DISCONNECTED' });
  expect(s.adapter.token).not.toHaveBeenCalled();
  expect((await restarted.disconnect()).state).toBe(
    'DISCONNECTED_REVOCATION_UNCONFIRMED',
  );
  expect(s.adapter.revoke).not.toHaveBeenCalled();
});

it('periodic status refresh cannot supersede a stable signed-in explicit Connect', async () => {
  const { createConnectionQueue } =
    await import('../apps/extension/account/connection-queue');
  const s = setup();
  let release!: () => void;
  const selected = {
    userId: 'owner',
    sessionId: 'session',
    label: 'Synthetic',
    expiresAt: Date.now() + 60_000,
  };
  let first = true;
  const gate = createAccountGate(async () => {
    if (first) {
      first = false;
      await new Promise<void>((done) => {
        release = done;
      });
    }
    return selected;
  });
  gates.push(gate);
  const mailbox = createAuthenticatedMailbox(gate, s.lifecycle);
  const queue = createConnectionQueue();
  const connect = queue.run(() => mailbox.connect());
  for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
  const statusPoll = queue.run(() => gate.refresh());
  for (let i = 0; i < 10; i++) await Promise.resolve();
  release();
  expect((await connect).state).toBe('CONNECTED');
  expect(await statusPoll).not.toBeNull();
  expect(s.adapter.token).toHaveBeenCalledOnce();
});
