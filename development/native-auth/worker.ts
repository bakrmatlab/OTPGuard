import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { createNativeAuth, publicAuthError } from './client';

const auth = createNativeAuth(process.env.OTPGUARD_NATIVE_CLERK_ORIGIN!);
const convexOrigin = process.env.OTPGUARD_NATIVE_CONVEX_ORIGIN!;
// Only the packaged extension page can initiate auth. No external/content messages.
chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL('login.html')
  )
    return false;
  const run = async () => {
    if (!message || typeof message !== 'object') throw new Error();
    const m = message as Record<string, unknown>;
    switch (m.action) {
      case 'register':
        if (typeof m.identifier !== 'string' || typeof m.secret !== 'string')
          throw new Error();
        return auth.register(m.identifier, m.secret);
      case 'start':
        if (typeof m.identifier !== 'string') throw new Error();
        return auth.start(m.identifier);
      case 'email':
        return auth.prepareEmail();
      case 'verify':
        if (
          typeof m.secret !== 'string' ||
          !['password', 'email_code', 'totp', 'backup_code'].includes(
            String(m.strategy),
          )
        )
          throw new Error();
        return auth.verify(
          m.strategy as 'password' | 'email_code' | 'totp' | 'backup_code',
          m.secret,
        );
      case 'status':
        return auth.status();
      case 'cancel':
        auth.cancel();
        return 'CANCELLED';
      case 'logout':
        return auth.signOut();
      case 'convex':
        return auth.withConvexToken(async (token, userId) => {
          const client = new ConvexHttpClient(convexOrigin, {
            logger: false,
            fetch: (input, options) => {
              const url = new URL(String(input));
              if (
                url.origin !== convexOrigin ||
                url.pathname !== '/api/query' ||
                url.search ||
                url.hash
              )
                throw new Error('INVALID_CONVEX_ENDPOINT');
              return fetch(input, {
                ...options,
                credentials: 'omit',
                redirect: 'error',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                signal: AbortSignal.timeout(15_000),
              });
            },
          });
          client.setAuth(token);
          try {
            const result = await client.query(
              makeFunctionReference<'query', Record<string, never>, string>(
                'authProbe:subject',
              ),
              {},
            );
            if (result !== userId) throw new Error();
            return 'CONVEX_IDENTITY_VERIFIED';
          } finally {
            client.clearAuth();
          }
        });
      default:
        throw new Error();
    }
  };
  void run().then(
    (state) => respond({ state }),
    (error) =>
      respond({
        state: publicAuthError(error),
      }),
  );
  return true;
});
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('login.html') });
});
