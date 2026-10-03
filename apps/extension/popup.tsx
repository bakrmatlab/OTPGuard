import { useEffect, useState } from 'react';
import { configuredAccount } from './account/config';
type Status = { state: string; userId?: string; label?: string };
export default function Popup() {
  const [status, setStatus] = useState<Status>({ state: 'CHECKING' });
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
      <p>No mailbox connected. OTPGuard sign-in does not grant Gmail access.</p>
      <p role="status">Gmail connection and autofill are not yet supported.</p>
    </main>
  );
}
