import type { ProgressSnapshot } from './pipeline/progress';
import type { RetrievalIssue } from './gmail/retrieval';
import type { CancellationReason } from './pipeline/coordinator';
export type PopupSnapshot = {
  state: string;
  requestId?: string;
  reason?: string;
  replay?: 'already-used' | 'unavailable';
  retrievalIssue?: RetrievalIssue;
  cancellation?: CancellationReason;
  progress?: ProgressSnapshot;
  prompt?: 'requested' | 'unavailable' | 'manual';
};
const titles: Record<string, string> = {
  IDLE: 'Ready to find',
  READY: 'Code found',
  SEARCHING: 'Finding a code…',
  FILLING: 'Inserting your code',
  CANDIDATE: 'Completing your request',
  VERIFIED: 'Completing your request',
  FILLED: 'Code inserted',
  NO_CODE: 'No code found',
  UNKNOWN: 'Could not select a code',
  CANCELLED: 'Request stopped',
  BLOCKED: 'Site blocked',
  MISMATCH: 'Destination does not match',
  ERROR: 'Could not complete the request',
  UNAVAILABLE: 'Request unavailable',
  DELIVERY_UNCONFIRMED: 'Insertion not confirmed',
  EMAIL_CONFIRMATION_REQUIRED: 'Is this an email code?',
  ACCOUNT_UNAVAILABLE: 'Sign in to find a code',
  MAILBOX_UNAVAILABLE: 'Reconnect Gmail',
  PAGE_UNAVAILABLE: 'Return to the login page',
  NO_CHALLENGE: 'Code field not detected',
  CONTENT_UNAVAILABLE: 'Reload the login page',
};
const descriptions: Record<string, string> = {
  IDLE: 'Open a page asking for an email code.',
  READY: '',
  SEARCHING: 'Checking recent email.',
  FILLING: 'Waiting for the page.',
  CANDIDATE: 'Waiting for insertion confirmation.',
  VERIFIED: 'Waiting for insertion confirmation.',
  FILLED: 'Check the site to continue.',
  NO_CODE: 'Request a new code, then retry.',
  UNKNOWN: 'Use the code from your email.',
  CANCELLED: 'Return to the code field, then retry.',
  BLOCKED: 'Manage blocked sites in browser settings.',
  MISMATCH: 'Use your usual manual sign-in.',
  ERROR: 'Return to the code field, then retry.',
  UNAVAILABLE: 'Reopen OTPGuard to try again.',
  DELIVERY_UNCONFIRMED: 'Check the site before trying again.',
  EMAIL_CONFIRMATION_REQUIRED: 'Confirm only if this code comes by email.',
  ACCOUNT_UNAVAILABLE: 'Open OTPGuard to sign in.',
  MAILBOX_UNAVAILABLE: 'Connect the Gmail mailbox that receives your codes.',
  PAGE_UNAVAILABLE: 'Keep your login page active, then retry.',
  NO_CHALLENGE: 'Open a supported empty email code field.',
  CONTENT_UNAVAILABLE: 'Reload the page, then retry.',
};
export function popupPresentation(
  pipeline: PopupSnapshot,
  account: string,
  siteAccess: boolean | null,
) {
  const busy = ['SEARCHING', 'FILLING', 'CANDIDATE', 'VERIFIED'].includes(
    pipeline.state,
  );
  if (account === 'CHECKING')
    return {
      title: 'Checking account…',
      detail: '',
      fill: false,
      retry: false,
      busy: false,
    };
  if (account !== 'SIGNED_IN')
    return {
      title:
        account === 'UNCONFIGURED' ? 'Setup needed' : 'Sign in to find a code',
      detail: 'Sign in with your OTPGuard account to continue.',
      fill: false,
      retry: false,
      busy: false,
    };
  if (siteAccess === false && !busy && pipeline.state !== 'READY')
    return {
      title: 'Website access needed',
      detail:
        'Allow OTPGuard to detect code fields on websites. Gmail access is separate.',
      fill: false,
      retry: false,
      busy: false,
    };
  let title = titles[pipeline.state] ?? 'Request unavailable';
  let detail = descriptions[pipeline.state] ?? 'Reopen OTPGuard to try again.';
  if (pipeline.replay) {
    title =
      pipeline.replay === 'already-used'
        ? 'Code already used'
        : 'Local protection unavailable';
    detail =
      pipeline.replay === 'already-used'
        ? 'Request a new code, then retry.'
        : 'Try again when local storage is available.';
  } else if (pipeline.state === 'UNKNOWN' && pipeline.reason === 'ambiguity') {
    title = 'Multiple possible codes';
    detail = 'Use the code from your email.';
  } else if (pipeline.state === 'UNKNOWN' && pipeline.retrievalIssue) {
    const issue = pipeline.retrievalIssue;
    detail =
      issue === 'network'
        ? 'Check your connection, then retry.'
        : issue === 'quota'
          ? 'Gmail limited requests. Wait before retrying.'
          : issue === 'mailbox'
            ? 'Reconnect Gmail in browser settings.'
            : issue === 'limit'
              ? 'Too much recent mail. Wait, then request a new code.'
              : 'A recent email could not be checked safely. Try again later.';
  } else if (
    pipeline.state === 'CANCELLED' &&
    pipeline.cancellation === 'confirmation-expired'
  ) {
    title = 'Code expired';
    detail = 'Request a new code, then retry.';
  } else if (
    pipeline.state === 'CANCELLED' &&
    [
      'navigation',
      'current-changed',
      'focus-changed',
      'tab-changed',
      'page-cancelled',
    ].includes(pipeline.cancellation ?? '')
  ) {
    title = 'Page changed';
    detail = 'Return to the code field, then retry.';
  }
  return {
    title,
    detail,
    fill:
      pipeline.state === 'READY' && !!pipeline.requestId && !pipeline.replay,
    retry:
      !busy &&
      ![
        'READY',
        'FILLED',
        'BLOCKED',
        'MISMATCH',
        'ACCOUNT_UNAVAILABLE',
        'MAILBOX_UNAVAILABLE',
      ].includes(pipeline.state) &&
      !(
        pipeline.state === 'UNKNOWN' &&
        (pipeline.reason === 'ambiguity' ||
          pipeline.retrievalIssue === 'mailbox')
      ),
    busy,
  };
}
