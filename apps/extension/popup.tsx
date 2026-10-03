import type { MailboxStatus } from './gmail/lifecycle';
import { configuredGmail } from './gmail/config';
import { useEffect, useState } from 'react';
import { configuredAccount } from './account/config';
type Status = { state: string; userId?: string; label?: string };
const unavailableMailbox = (): MailboxStatus => ({
  state: configuredGmail() ? 'RECONNECT_REQUIRED' : 'UNCONFIGURED',
});
export default function Popup() {
  const [status, setStatus] = useState<Status>({ state: 'CHECKING' });
  const [mailbox, setMailbox] = useState<MailboxStatus>({
    state: 'DISCONNECTED',
  });
  const [busy, setBusy] = useState(false);
  const mailboxAction = async (type: string) => {
    setBusy(true);
    try {
      setMailbox(
        (await chrome.runtime.sendMessage({ type })) ?? unavailableMailbox(),
      );
    } catch {
      setMailbox(unavailableMailbox());
    } finally {
      setBusy(false);
    }
  };
  const config = configuredAccount();
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void chrome.runtime
        .sendMessage({ type: 'account-status' })
        .then((value: Status) => {
          if (active) setStatus(value ?? { state: 'SIGN_IN_REQUIRED' });
        })
        .catch(() => {
          if (active) setStatus({ state: 'SIGN_IN_REQUIRED' });
        });
    };
    refresh();
    void chrome.runtime
      .sendMessage({ type: 'gmail-status' })
      .then((value: MailboxStatus) => {
        if (active) setMailbox(value ?? unavailableMailbox());
      })
      .catch(() => {
        if (active) setMailbox(unavailableMailbox());
      });
    const timer = setInterval(refresh, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <main style={{ width: 340, padding: 20, fontFamily: 'system-ui' }}>
      <h1>OTPGuard</h1>
      <h2>OTPGuard account</h2>
      <p>
        {status.state === 'UNCONFIGURED'
          ? 'Account authentication is unconfigured.'
          : status.state === 'SIGNED_IN'
            ? status.label
            : status.state === 'SIGN_OUT_FAILED'
              ? 'Sign-out could not be confirmed. Open the account host to sign out and retry.'
              : status.state === 'CHECKING'
                ? 'Checking account session…'
                : 'Sign in to your OTPGuard account.'}
      </p>
      {status.userId && <p>Account ID: {status.userId}</p>}
      {config && (
        <a
          href={config.webOrigin + '/sign-in'}
          target="_blank"
          rel="noreferrer"
        >
          Open account sign-in
        </a>
      )}
      {status.state === 'SIGNED_IN' && (
        <button
          onClick={() => {
            setStatus({ state: 'CHECKING' });
            void chrome.runtime
              .sendMessage({ type: 'account-sign-out' })
              .then((value: Status | undefined) =>
                setStatus(value ?? { state: 'SIGN_OUT_FAILED' }),
              )
              .catch(() => setStatus({ state: 'SIGN_OUT_FAILED' }));
          }}
        >
          Sign out of OTPGuard
        </button>
      )}
      <h2>Gmail mailbox</h2>
      <p>
        OTPGuard sign-in does not grant Gmail access. The mailbox may differ
        from your OTPGuard account.
      </p>
      <p aria-live="polite">{mailboxText[mailbox.state]}</p>
      {mailbox.mailbox && <p>Mailbox: {mailbox.mailbox}</p>}
      {mailbox.state !== 'UNCONFIGURED' && (
        <>
          <p>
            Connect requests read-only access to all Gmail mail. Chrome chooses
            a Google account from this browser profile; confirm the mailbox
            shown below before using it.
          </p>
          <button
            disabled={busy || mailbox.state === 'CONNECTED'}
            onClick={() => void mailboxAction('gmail-connect')}
          >
            Connect Gmail
          </button>
          <button
            disabled={busy}
            onClick={() => void mailboxAction('gmail-status')}
          >
            Check Gmail connection
          </button>
          <button
            disabled={busy}
            onClick={() => void mailboxAction('gmail-disconnect')}
          >
            Disconnect Gmail
          </button>
        </>
      )}
      <p role="status">Real Gmail retrieval and autofill remain disabled.</p>
    </main>
  );
}

const mailboxText: Record<MailboxStatus['state'], string> = {
  UNCONFIGURED:
    'Gmail connection is unconfigured. Register a Google Chrome extension OAuth client and stable extension ID first.',
  DISCONNECTED: 'No mailbox connected.',
  CONNECTING: 'Waiting for Google consent…',
  CONNECTED: 'Gmail mailbox connected for this worker session.',
  CONNECT_FAILED:
    'Connection was denied or could not be completed. Use Connect Gmail to retry.',
  SCOPE_REQUIRED:
    'Read-only Gmail permission was not granted. Use Connect Gmail to retry.',
  RECONNECT_REQUIRED:
    'Gmail connection needs checking. Use Connect Gmail to reconnect.',
  MAILBOX_CHANGED:
    'Google returned a different mailbox. Disconnect first, then connect and confirm the new mailbox.',
  DISCONNECTING: 'Disconnecting Gmail…',
  DISCONNECTED_REVOCATION_UNCONFIRMED:
    'Disconnected locally. Google revocation could not be confirmed. Remove OTPGuard access in your Google account permissions.',
  DISCONNECTED_CACHE_CLEAR_FAILED:
    'Disconnected locally, but Chrome credential cache cleanup failed. Remove OTPGuard access in Google account permissions and retry Disconnect.',
};
