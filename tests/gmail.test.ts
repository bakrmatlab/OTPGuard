import { expect, it, vi } from 'vitest';
import {
  createGmailLifecycle,
  GmailUnauthorized,
  type GmailAdapter,
} from '../apps/extension/gmail/lifecycle';
import { GMAIL_SCOPE, gmailConfig } from '../apps/extension/gmail/config';
const setup = () => {
  const adapter: GmailAdapter = {
    token: vi.fn(async () => ({
      token: 'synthetic-credential',
      grantedScopes: [GMAIL_SCOPE],
    })),
    profile: vi.fn(async () => 'mailbox@fixture.invalid'),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    revoke: vi.fn(async () => true),
  };
  return { adapter, lifecycle: createGmailLifecycle(adapter, true) };
};
it('never prompts on status/startup; connects explicitly and returns only mailbox status', async () => {
  const { adapter, lifecycle } = setup();
  expect(await lifecycle.check()).toEqual({ state: 'DISCONNECTED' });
  expect(adapter.token).not.toHaveBeenCalled();
  expect(await lifecycle.connect()).toEqual({
    state: 'CONNECTED',
    mailbox: 'mailbox@fixture.invalid',
  });
  expect(adapter.token).toHaveBeenCalledWith(true);
  await lifecycle.check();
  expect(adapter.token).toHaveBeenLastCalledWith(false);
  expect(JSON.stringify(lifecycle.snapshot())).not.toContain(
    'synthetic-credential',
  );
});
it('denial and missing/partial granted scopes fail closed and permit an explicit retry', async () => {
  const { adapter, lifecycle } = setup();
  vi.mocked(adapter.token).mockRejectedValueOnce(new Error('denied'));
  expect((await lifecycle.connect()).state).toBe('CONNECT_FAILED');
  vi.mocked(adapter.token).mockResolvedValueOnce({
    token: 'synthetic-credential',
    grantedScopes: [],
  });
  expect((await lifecycle.connect()).state).toBe('SCOPE_REQUIRED');
  expect(adapter.profile).not.toHaveBeenCalled();
  expect(adapter.remove).toHaveBeenCalled();
  expect((await lifecycle.connect()).state).toBe('CONNECTED');
});
it('refreshes an invalid token once without prompting; revocation requires reconnect', async () => {
  const { adapter, lifecycle } = setup();
  vi.mocked(adapter.profile).mockRejectedValueOnce(new GmailUnauthorized());
  expect((await lifecycle.connect()).state).toBe('CONNECTED');
  expect(adapter.token).toHaveBeenLastCalledWith(false);
  vi.mocked(adapter.profile).mockRejectedValue(new GmailUnauthorized());
  const cancel = vi.fn();
  lifecycle.subscribe(cancel);
  expect((await lifecycle.check()).state).toBe('RECONNECT_REQUIRED');
  expect(cancel).toHaveBeenCalled();
  expect(adapter.profile).toHaveBeenCalledTimes(4);
  vi.mocked(adapter.profile).mockResolvedValue('mailbox@fixture.invalid');
  expect((await lifecycle.connect()).state).toBe('CONNECTED');
});
it('rejects mailbox replacement until disconnect; Google and OTPGuard identities need not match', async () => {
  const { adapter, lifecycle } = setup();
  await lifecycle.connect();
  vi.mocked(adapter.profile).mockResolvedValue('other@fixture.invalid');
  expect(await lifecycle.check()).toEqual({ state: 'MAILBOX_CHANGED' });
  expect((await lifecycle.connect()).state).toBe('MAILBOX_CHANGED');
  await lifecycle.disconnect();
  expect(await lifecycle.connect()).toEqual({
    state: 'CONNECTED',
    mailbox: 'other@fixture.invalid',
  });
});
it.each(['remote', 'cache', 'no-token'] as const)(
  'reports %s disconnect failure without retaining mailbox',
  async (kind) => {
    const { adapter, lifecycle } = setup();
    await lifecycle.connect();
    if (kind === 'remote') vi.mocked(adapter.revoke).mockResolvedValue(false);
    if (kind === 'cache')
      vi.mocked(adapter.clear).mockRejectedValue(new Error('cache failure'));
    if (kind === 'no-token')
      vi.mocked(adapter.token).mockRejectedValue(new Error('revoked'));
    const cancel = vi.fn();
    lifecycle.subscribe(cancel);
    expect(await lifecycle.disconnect()).toEqual({
      state:
        kind === 'cache'
          ? 'DISCONNECTED_CACHE_CLEAR_FAILED'
          : 'DISCONNECTED_REVOCATION_UNCONFIRMED',
    });
    expect(cancel).toHaveBeenCalled();
    expect(adapter.clear).toHaveBeenCalled();
  },
);
it('disconnect aborts profile work immediately and stale completion cannot reconnect', async () => {
  const { adapter, lifecycle } = setup();
  let finish!: (value: string) => void;
  let signal!: AbortSignal;
  vi.mocked(adapter.profile).mockImplementationOnce(async (_, abort) => {
    signal = abort;
    return new Promise((done) => {
      finish = done;
    });
  });
  const pending = lifecycle.connect();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const disconnect = lifecycle.disconnect();
  expect(signal.aborted).toBe(true);
  expect(lifecycle.snapshot()).toEqual({ state: 'DISCONNECTING' });
  finish('mailbox@fixture.invalid');
  await pending;
  expect(await disconnect).toEqual({ state: 'DISCONNECTED' });
});
it('Google sign-in changes cancel bindings and stale grants cannot restore state', async () => {
  const { adapter, lifecycle } = setup();
  let finish!: (value: { token: string; grantedScopes: string[] }) => void;
  vi.mocked(adapter.token).mockImplementationOnce(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  const pending = lifecycle.connect();
  lifecycle.invalidate();
  finish({ token: 'synthetic-credential', grantedScopes: [GMAIL_SCOPE] });
  expect(await pending).toEqual({ state: 'RECONNECT_REQUIRED' });
  expect(adapter.profile).not.toHaveBeenCalled();
  expect(adapter.remove).toHaveBeenCalled();
});
it('unconfigured lifecycle and partial configuration perform no OAuth', async () => {
  const { adapter } = setup();
  const lifecycle = createGmailLifecycle(adapter, false);
  expect((await lifecycle.connect()).state).toBe('UNCONFIGURED');
  expect((await lifecycle.disconnect()).state).toBe('UNCONFIGURED');
  expect(adapter.token).not.toHaveBeenCalled();
  expect(gmailConfig({})).toBeNull();
  expect(() => gmailConfig({ clientId: 'invented' })).toThrow();
});
it('mailbox disconnect cancels actual connected coordinator work while Clerk remains mandatory', async () => {
  const { createMailboxCoordinator } =
    await import('../apps/extension/gmail/connected');
  const { createAccountGate } = await import('../apps/extension/account/gate');
  const { lifecycle } = setup();
  await lifecycle.connect();
  const gate = createAccountGate(async () => ({
    userId: 'otpguard-user',
    sessionId: 'session',
    label: 'Synthetic',
    expiresAt: Date.now() + 30_000,
  }));
  let finish!: (value: null) => void;
  let signal: AbortSignal | undefined;
  const retrieve = vi.fn(async (_: unknown, abort: AbortSignal) => {
    signal = abort;
    return new Promise<null>((done) => {
      finish = done;
    });
  });
  const adapter = {
    now: Date.now,
    id: () => 'request',
    registry: [],
    context: async () => ({
      accountId: 'untrusted',
      mailboxId: 'mailbox@fixture.invalid',
      tabId: 1,
      documentId: 'document',
      origin: 'https://fixture.invalid',
      browserUrl: 'https://fixture.invalid/',
      policyUrl: 'https://fixture.invalid/',
      foreground: true,
      serviceId: 'unsupported',
    }),
    current: async () => true,
    retrieve,
    send: vi.fn(),
  };
  const coordinator = createMailboxCoordinator(adapter, gate, lifecycle);
  const message = {
    type: 'detect',
    groupId: 'fields',
    expectedLength: 6,
    groupCount: 1,
    emailFlow: true,
  };
  const pending = coordinator.handle(message, {});
  for (let i = 0; i < 50 && !signal; i++) await Promise.resolve();
  expect(signal).toBeDefined();
  await lifecycle.disconnect();
  expect(signal?.aborted).toBe(true);
  finish(null);
  expect((await pending).state).toBe('CANCELLED');
  expect(adapter.send).not.toHaveBeenCalled();
  coordinator.dispose();
  gate.invalidate();
  await lifecycle.connect();
  const unavailable = createMailboxCoordinator(
    adapter,
    createAccountGate(async () => null),
    lifecycle,
  );
  retrieve.mockClear();
  expect((await unavailable.handle(message, {})).state).toBe('UNKNOWN');
  expect(retrieve).not.toHaveBeenCalled();
  unavailable.dispose();
});
it('sign-in changes during revocation cannot reopen connection before cache cleanup', async () => {
  const { adapter, lifecycle } = setup();
  await lifecycle.connect();
  let finish!: (value: boolean) => void;
  vi.mocked(adapter.revoke).mockImplementationOnce(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  const disconnect = lifecycle.disconnect();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  lifecycle.invalidate();
  expect((await lifecycle.connect()).state).toBe('DISCONNECTING');
  finish(true);
  expect((await disconnect).state).toBe('DISCONNECTED');
});

it('cannot claim old mailbox revocation with a newly selected Google account token', async () => {
  const { adapter, lifecycle } = setup();
  await lifecycle.connect();
  vi.mocked(adapter.profile).mockResolvedValue('other@fixture.invalid');
  expect((await lifecycle.disconnect()).state).toBe(
    'DISCONNECTED_REVOCATION_UNCONFIRMED',
  );
  expect(adapter.revoke).not.toHaveBeenCalled();
  expect(adapter.clear).toHaveBeenCalled();
});
it('limits configured Gmail permissions, hosts, scope and CSP independently of account authentication', async () => {
  const { connectionManifest } = await import('../apps/extension/gmail/config');
  const manifest = connectionManifest(null, {
    clientId: 'synthetic.apps.googleusercontent.com',
    key: 'cHVibGlj',
    extensionId: 'a'.repeat(32),
  });
  expect(manifest.permissions).toEqual(['identity']);
  expect(manifest.host_permissions).toEqual([
    'https://gmail.googleapis.com/*',
    'https://oauth2.googleapis.com/revoke',
  ]);
  expect(manifest.oauth2?.scopes).toEqual([GMAIL_SCOPE]);
  expect(manifest.content_security_policy.extension_pages).toBe(
    "script-src 'self'; object-src 'none'; connect-src https://gmail.googleapis.com https://oauth2.googleapis.com;",
  );
});
