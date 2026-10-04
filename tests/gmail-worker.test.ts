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

it.each(['declared', 'streamed'] as const)(
  'rejects %s oversized profile responses before connecting and cancels the stream',
  async (kind) => {
    const cancel = vi.fn();
    const remove = vi.fn(async () => {});
    const token = vi.fn(async () => ({
      token: 'synthetic-worker-credential',
      grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    }));
    const fetcher = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.enqueue(
                new TextEncoder().encode(' '.repeat(16 * 1024 + 1)),
              );
            },
            cancel,
          }),
          {
            headers:
              kind === 'declared'
                ? { 'content-length': String(16 * 1024 + 1) }
                : {},
          },
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('chrome', {
      runtime: { id: 'synthetic-id' },
      identity: {
        getAuthToken: token,
        removeCachedAuthToken: remove,
        clearAllCachedAuthTokens: vi.fn(async () => {}),
        onSignInChanged: { addListener: vi.fn() },
      },
    });
    const { gmailLifecycle } = await import('../apps/extension/gmail/worker');
    expect(await gmailLifecycle.connect()).toEqual({ state: 'CONNECT_FAILED' });
    expect(token).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith({
      token: 'synthetic-worker-credential',
    });
    expect(cancel).toHaveBeenCalledOnce();
  },
);
