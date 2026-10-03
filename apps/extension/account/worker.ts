import { createClerkClient } from '@clerk/chrome-extension/client';
import { configuredAccount } from './config';
import { createAccountGate } from './gate';
const config = configuredAccount();
let signingOut = false;
// Clerk's default cache persists a client JWT. Use no fallback cache: cookie is authoritative.
const storageCache = {
  createKey: (...keys: string[]) => keys.join('|'),
  get: async () => undefined,
  set: async () => {},
  remove: async () => {},
};
export const accountGate = createAccountGate(async () => {
  if (!config || signingOut) return null;
  const clerk = await createClerkClient({
    publishableKey: config.publishableKey,
    syncHost: config.syncHost,
    background: true,
    storageCache,
  });
  const session = clerk.session;
  if (!session || session.status !== 'active' || !clerk.user) return null;
  // Freshness probe only. Never send this token to popup/content/page/backend or retain it.
  if (!(await session.getToken({ skipCache: true }))) return null;
  if (
    signingOut ||
    clerk.session?.id !== session.id ||
    session.status !== 'active'
  )
    return null;
  return {
    userId: clerk.user.id,
    sessionId: session.id,
    expiresAt: Math.min(session.expireAt.getTime(), Date.now() + 30_000),
    label: clerk.user.primaryEmailAddress?.emailAddress ?? clerk.user.id,
  };
});
if (config) {
  void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  chrome.cookies.onChanged.addListener(({ cookie }) => {
    const host = new URL(config.syncHost).hostname;
    const domain = cookie.domain.replace(/^\./, '');
    if (
      (host === domain || host.endsWith('.' + domain)) &&
      ['__client', '__clerk_uat'].includes(cookie.name)
    )
      accountGate.invalidate();
  });
}
export async function accountStatus() {
  if (!config) return { state: 'UNCONFIGURED' as const };
  await accountGate.refresh();
  const identity = accountGate.identity();
  return identity
    ? {
        state: 'SIGNED_IN' as const,
        userId: identity.userId,
        label: identity.label,
      }
    : { state: 'SIGN_IN_REQUIRED' as const };
}
export async function signOutAccount() {
  signingOut = true;
  accountGate.invalidate();
  try {
    if (!config) return;
    const clerk = await createClerkClient({
      publishableKey: config.publishableKey,
      syncHost: config.syncHost,
      background: true,
      storageCache,
    });
    await clerk.signOut();
  } finally {
    accountGate.invalidate();
    signingOut = false;
  }
}
