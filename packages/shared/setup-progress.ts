import type { BrowserSnapshot } from './browser-management';
/** Readiness derives from observed browser state, never from a successful click. */
export function setupProgress(
  signedIn: boolean,
  snapshot: BrowserSnapshot | null,
) {
  if (!signedIn)
    return {
      step: 1,
      title: 'Sign in to OTPGuard',
      action: 'sign-in',
    } as const;
  if (!snapshot)
    return {
      step: 2,
      title: 'Connect this browser',
      action: 'browser-status',
    } as const;
  if (snapshot.mailbox.state !== 'CONNECTED')
    return {
      step: 3,
      title: 'Connect Gmail',
      action: 'gmail-connect',
    } as const;
  if (!snapshot.siteAccess)
    return {
      step: 4,
      title: 'Enable website access',
      action: 'open-options',
    } as const;
  return { step: 4, title: 'You’re ready', action: 'ready' } as const;
}
