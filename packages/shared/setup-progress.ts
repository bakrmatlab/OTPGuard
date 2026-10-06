import type { BrowserSnapshot } from './browser-management';
type SetupSnapshot = Pick<
  BrowserSnapshot,
  'mailbox' | 'settings' | 'siteAccess'
>;
interface SetupProgress {
  step: number;
  title: string;
  detail: string;
  action:
    | 'sign-in'
    | 'browser-status'
    | 'gmail-connect'
    | 'open-options'
    | 'ready';
}
/** Completion requires observed permission, mailbox and readable local settings. */
export function setupProgress(
  signedIn: boolean,
  snapshot: SetupSnapshot | null,
  checking = false,
): SetupProgress {
  if (checking)
    return {
      step: 1,
      title: 'Checking setup…',
      detail: 'Waiting for current account and browser status.',
      action: 'browser-status',
    };
  if (!signedIn)
    return {
      step: 1,
      title: 'Sign in to OTPGuard',
      detail: 'Your OTPGuard account signs you in. Gmail access comes next.',
      action: 'sign-in',
    };
  if (!snapshot)
    return {
      step: 2,
      title: 'Connect this browser',
      detail:
        'Connect your installed OTPGuard extension to check its existing setup. Existing connections are kept.',
      action: 'browser-status',
    };
  const mailbox = snapshot.mailbox.state;
  if (mailbox !== 'CONNECTED') {
    const states: Record<string, [string, string, SetupProgress['action']]> = {
      DISCONNECTED: [
        'Connect Gmail',
        'Choose the mailbox that receives your codes.',
        'gmail-connect',
      ],
      CONNECT_FAILED: [
        'Try Gmail connection again',
        'Google consent was denied or the connection failed. Try again.',
        'gmail-connect',
      ],
      SCOPE_REQUIRED: [
        'Grant Gmail access',
        'Reconnect and approve read-only Gmail permission.',
        'gmail-connect',
      ],
      RECONNECT_REQUIRED: [
        'Reconnect Gmail',
        'Your Gmail access needs to be restored.',
        'gmail-connect',
      ],
      SIGN_IN_REQUIRED: [
        'Restore extension sign-in',
        'Sign in with the same OTPGuard account in the extension, then check this browser again.',
        'open-options',
      ],
      ACCOUNT_CHANGED: [
        'Resolve account change',
        'Disconnect Gmail in browser settings, then connect it for the current session.',
        'open-options',
      ],
      MAILBOX_CHANGED: [
        'Resolve mailbox change',
        'Google returned a different mailbox. Disconnect Gmail in browser settings, then reconnect.',
        'open-options',
      ],
      UNCONFIGURED: [
        'Extension configuration needed',
        'This extension build cannot connect to Gmail. Load the configured build, then check this browser again.',
        'open-options',
      ],
      CONNECTING: [
        'Connecting Gmail…',
        'Finish Google consent, then check the connection again.',
        'browser-status',
      ],
      DISCONNECTING: [
        'Disconnecting Gmail…',
        'Wait for disconnection to finish, then check the connection again.',
        'browser-status',
      ],
      DISCONNECTED_REVOCATION_UNCONFIRMED: [
        'Confirm Gmail disconnection',
        'Disconnected locally. Remove OTPGuard access in Google account permissions to confirm revocation, then reconnect.',
        'open-options',
      ],
      DISCONNECTED_CACHE_CLEAR_FAILED: [
        'Finish Gmail cleanup',
        'Chrome credential cleanup failed. Retry Disconnect Gmail in browser settings before reconnecting.',
        'open-options',
      ],
    };
    const [title, detail, action] = states[mailbox] ?? [
      'Check Gmail status',
      'Gmail status is unavailable. Check again before continuing.',
      'browser-status',
    ];
    return { step: 3, title, detail, action };
  }
  if (!snapshot.siteAccess)
    return {
      step: 4,
      title: 'Enable website access',
      detail:
        'Gmail is connected. Website access is separate: choose Enable website access in extension settings and approve Chrome’s prompt.',
      action: 'open-options',
    };
  if (snapshot.settings.state !== 'LOCAL')
    return {
      step: 4,
      title: 'Check local settings',
      detail:
        'Gmail and website access are connected, but local preferences could not be read. Open browser settings to resolve this.',
      action: 'open-options',
    };
  return {
    step: 4,
    title: 'Setup complete',
    detail: snapshot.settings.autofillEnabled
      ? 'Your extension is already set up. Open a page asking for an email code. OTPGuard finds it; you click Fill.'
      : 'Your extension is already set up. Automatic finding is off: choose Find code in the popup or enable automatic finding in Preferences.',
    action: 'ready',
  };
}
