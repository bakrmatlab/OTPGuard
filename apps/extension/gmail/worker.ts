import { configuredGmail } from './config';
import { createGmailLifecycle, GmailUnauthorized } from './lifecycle';
const config = configuredGmail();
const configured = !!config && config.extensionId === chrome.runtime.id;
const request = (url: string, init: RequestInit) =>
  fetch(url, {
    ...init,
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
  });
export const gmailLifecycle = createGmailLifecycle(
  {
    token: (interactive) =>
      chrome.identity.getAuthToken({
        interactive,
        enableGranularPermissions: true,
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      }),
    remove: (token) => chrome.identity.removeCachedAuthToken({ token }),
    clear: () => chrome.identity.clearAllCachedAuthTokens(),
    async profile(token, signal) {
      const response = await request(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: 'Bearer ' + token }, signal },
      );
      if (response.status === 401) throw new GmailUnauthorized();
      if (!response.ok) throw new Error('Gmail profile unavailable');
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !('emailAddress' in body) ||
        typeof body.emailAddress !== 'string'
      )
        throw new Error('Invalid Gmail profile');
      return body.emailAddress;
    },
    async revoke(token) {
      const response = await request('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      });
      return response.ok;
    },
  },
  configured,
);
if (configured)
  chrome.identity.onSignInChanged.addListener(() =>
    gmailLifecycle.invalidate(),
  );
