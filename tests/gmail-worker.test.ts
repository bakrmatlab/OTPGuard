import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../apps/extension/gmail/config', () => ({
  GMAIL_SCOPE: 'https://www.googleapis.com/auth/gmail.readonly',
  configuredGmail: () => ({ extensionId: 'synthetic-id' }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('uses only direct Google header/body credentials, no storage, and closed mailbox responses', async () => {
  const token = 'synthetic-worker-credential';
  const storage = vi.fn();
  const remove = vi.fn(async () => {});
  const clear = vi.fn(async () => {});
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        url.includes('/profile')
          ? JSON.stringify({ emailAddress: 'mailbox@fixture.invalid' })
          : '',
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('chrome', {
    runtime: { id: 'synthetic-id' },
    storage: { local: { set: storage } },
    identity: {
      getAuthToken: vi.fn(async () => ({
        token,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      })),
      removeCachedAuthToken: remove,
      clearAllCachedAuthTokens: clear,
      onSignInChanged: { addListener: vi.fn() },
    },
  });
  const { gmailLifecycle } = await import('../apps/extension/gmail/worker');
  expect(await gmailLifecycle.connect()).toEqual({
    state: 'CONNECTED',
    mailbox: 'mailbox@fixture.invalid',
  });
  expect(await gmailLifecycle.disconnect()).toEqual({ state: 'DISCONNECTED' });
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    'https://oauth2.googleapis.com/revoke',
  ]);
  const calls = vi.mocked(fetch).mock.calls;
  expect(calls[0]![1]).toMatchObject({
    headers: { Authorization: 'Bearer ' + token },
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  expect(calls[2]![1]).toMatchObject({
    method: 'POST',
    body: 'token=' + token,
  });
  expect(storage).not.toHaveBeenCalled();
  expect(clear).toHaveBeenCalled();
  expect(JSON.stringify(gmailLifecycle.snapshot())).not.toContain(token);
});
