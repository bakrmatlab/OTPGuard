import { afterEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@clerk/chrome-extension/client', () => ({
  createClerkClient: sdk.create,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('never initializes Clerk or obtains a token for development keys on a Vercel host', async () => {
  sdk.create.mockClear();
  vi.stubEnv(
    'PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'pk_test_' + btoa('synthetic.clerk.accounts.dev$'),
  );
  vi.stubEnv(
    'PLASMO_PUBLIC_CLERK_FRONTEND_API',
    'https://synthetic.clerk.accounts.dev',
  );
  vi.stubEnv(
    'PLASMO_PUBLIC_CLERK_SYNC_HOST',
    'https://otpguard-fixture.vercel.app',
  );
  vi.stubEnv(
    'PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN',
    'https://otpguard-fixture.vercel.app',
  );
  const worker = await import('../apps/extension/account/worker');
  expect(await worker.accountStatus()).toEqual({ state: 'UNCONFIGURED' });
  expect(await worker.accountGate.refresh()).toBeNull();
  await worker.signOutAccount();
  expect(sdk.create).not.toHaveBeenCalled();
});
it('keeps freshness tokens in the worker and uses no persistent SDK JWT cache', async () => {
  vi.stubEnv(
    'PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'pk_live_' + btoa('auth.fixture.invalid$'),
  );
  vi.stubEnv(
    'PLASMO_PUBLIC_CLERK_FRONTEND_API',
    'https://auth.fixture.invalid',
  );
  vi.stubEnv('PLASMO_PUBLIC_CLERK_SYNC_HOST', 'https://auth.fixture.invalid');
  vi.stubEnv('PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN', 'https://app.fixture.invalid');
  const listeners: ((value: {
    cookie: { domain: string; name: string };
  }) => void)[] = [];
  const access = vi.fn(async () => {});
  vi.stubGlobal('chrome', {
    storage: { local: { setAccessLevel: access } },
    cookies: {
      onChanged: {
        addListener: (fn: (typeof listeners)[number]) => listeners.push(fn),
      },
    },
  });
  const token = vi.fn(async () => 'synthetic-session-token-never-export');
  const remove = vi.fn(async () => {});
  const signOut = vi.fn(async () => {
    throw new Error('Browser logout flow is unavailable in a worker');
  });
  const reload = vi.fn(async () => {});
  sdk.create.mockResolvedValue({
    user: {
      id: 'synthetic-user',
      primaryEmailAddress: { emailAddress: 'synthetic@fixture.invalid' },
    },
    session: {
      id: 'synthetic-session',
      status: 'active',
      expireAt: new Date(Date.now() + 120_000),
      getToken: token,
      reload,
      remove,
      user: { id: 'synthetic-user' },
    },
    signOut,
  });
  const worker = await import('../apps/extension/account/worker');
  const status = await worker.accountStatus();
  expect(status).toEqual({
    state: 'SIGNED_IN',
    userId: 'synthetic-user',
    label: 'synthetic@fixture.invalid',
  });
  expect(JSON.stringify(status)).not.toContain('token');
  expect(token).toHaveBeenCalledWith({ skipCache: true });
  const calls = token.mock.calls.length;
  reload.mockRejectedValueOnce(new Error('synthetic revoked session'));
  expect(await worker.accountStatus()).toEqual({ state: 'SIGN_IN_REQUIRED' });
  expect(token.mock.calls.length).toBe(calls);
  const options = sdk.create.mock.calls[0]![0];
  expect(options.background).toBe(true);
  await options.storageCache.set('key', 'synthetic-jwt');
  expect(await options.storageCache.get('key')).toBeUndefined();
  expect(access).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  const bound = (await worker.accountGate.refresh())!;
  listeners[0]!({
    cookie: { domain: '.fixture.invalid', name: '__clerk_uat' },
  });
  expect(await worker.accountGate.current(bound)).toBe(false);
  const cancelled = vi.fn();
  worker.accountGate.subscribe(cancelled);
  await worker.signOutAccount();
  expect(cancelled).toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith();
  expect(signOut).not.toHaveBeenCalled();
  remove.mockRejectedValueOnce(new Error('synthetic remote failure'));
  await expect(worker.signOutAccount()).rejects.toThrow('Sign-out unconfirmed');
  expect(await worker.accountStatus()).toEqual({ state: 'SIGN_OUT_FAILED' });
  expect(await worker.accountGate.refresh()).toBeNull();
  remove.mockImplementationOnce(async () => {
    sdk.create.mockResolvedValue({ user: null, session: null, signOut });
  });
  await worker.signOutAccount();
  expect(await worker.accountStatus()).toEqual({ state: 'SIGN_IN_REQUIRED' });
  worker.accountGate.invalidate();
});
