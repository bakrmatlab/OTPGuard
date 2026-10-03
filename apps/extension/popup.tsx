import './popup.css';
import type { ActivityEvent } from '../../packages/shared';
import { canonicalBlock } from './settings/local';
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
  const [mailbox, setMailbox] = useState<
    MailboxStatus | { state: 'CHECKING'; mailbox?: never }
  >({
    state: 'CHECKING',
  });
  const [settings, setSettings] = useState<{
    state: string;
    autofillEnabled?: boolean;
    blockedOrigins?: string[];
  }>({ state: 'CHECKING' });
  const [blockOrigin, setBlockOrigin] = useState('');
  const [history, setHistory] = useState<{
    state: string;
    count?: number;
    lastAction?: Pick<ActivityEvent, 'result' | 'reason' | 'time'>;
  }>({
    state: 'CHECKING',
  });
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyExport, setHistoryExport] = useState('');
  const historyAction = async (type: 'history-export' | 'history-delete') => {
    setHistoryBusy(true);
    setHistoryExport('');
    try {
      const result = await chrome.runtime.sendMessage({ type });
      if (type === 'history-export' && typeof result?.json === 'string')
        setHistoryExport(result.json);
      if (result?.state !== 'LOCAL') setHistory({ state: 'UNAVAILABLE' });
      else
        setHistory(
          (await chrome.runtime.sendMessage({ type: 'history-status' })) ?? {
            state: 'UNAVAILABLE',
          },
        );
    } catch {
      setHistory({ state: 'UNAVAILABLE' });
    } finally {
      setHistoryBusy(false);
    }
  };
  const changeBlock = async (origin: string, blocked: boolean) => {
    setSettingsBusy(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'settings-block',
        origin,
        blocked,
      });
      setSettings(result ?? { state: 'UNAVAILABLE' });
      if (result?.state === 'LOCAL') setBlockOrigin('');
    } catch {
      setSettings({ state: 'UNAVAILABLE' });
    } finally {
      setSettingsBusy(false);
    }
  };
  const [settingsBusy, setSettingsBusy] = useState(false);
  const changeAutofill = async (enabled: boolean) => {
    setSettingsBusy(true);
    try {
      setSettings(
        (await chrome.runtime.sendMessage({
          type: 'settings-autofill',
          enabled,
        })) ?? { state: 'UNAVAILABLE' },
      );
    } catch {
      setSettings({ state: 'UNAVAILABLE' });
    } finally {
      setSettingsBusy(false);
    }
  };
  const [busy, setBusy] = useState(false);
  const mailboxAction = async (type: string) => {
    setBusy(true);
    if (type === 'gmail-connect') setMailbox({ state: 'CONNECTING' });
    if (type === 'gmail-disconnect') setMailbox({ state: 'DISCONNECTING' });
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
      .sendMessage({ type: 'history-status' })
      .then((value) => {
        if (active) setHistory(value ?? { state: 'UNAVAILABLE' });
      })
      .catch(() => {
        if (active) setHistory({ state: 'UNAVAILABLE' });
      });
    void chrome.runtime
      .sendMessage({ type: 'settings-status' })
      .then((value) => {
        if (active) setSettings(value ?? { state: 'UNAVAILABLE' });
      })
      .catch(() => {
        if (active) setSettings({ state: 'UNAVAILABLE' });
      });
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
    <main>
      <header>
        <p className="eyebrow">Local connection prototype</p>
        <h1>OTPGuard</h1>
        <p>Connect your mailbox and manage local protection preferences.</p>
      </header>
      <section aria-labelledby="protection-title" className="protection">
        <h2 id="protection-title">Protection &amp; retrieval</h2>
        <p role="status">Real Gmail retrieval and autofill remain disabled.</p>
        <p>
          No supported real services are available. Sender verification is
          unresolved, so connecting Gmail or enabling a preference cannot start
          retrieval or fill.
        </p>
        <p>
          Security checks are mandatory. OTPGuard never reveals or copies a
          code, overrides verification, or submits a form. A site may submit
          when its input is filled.
        </p>
        <div className="actions">
          <button disabled aria-describedby="fill-limit">
            Fill verified code
          </button>
          <button disabled aria-describedby="fill-limit">
            Retry retrieval
          </button>
        </div>
        <p id="fill-limit" className="muted">
          Manual fill and retry are unsupported in this build.
        </p>
        <details>
          <summary>Understand protection states</summary>
          <dl>
            <dt>VERIFIED — authorized request</dt>
            <dd>
              All checks pass. Only a current, worker-authorized request can
              fill. No real service can reach this state in this build.
            </dd>
            <dt>UNKNOWN — insufficient evidence</dt>
            <dd>
              Unsupported service, unverified sender, or ambiguous evidence. No
              code is released; this does not mean the site is malicious.
            </dd>
            <dt>MISMATCH — different destination</dt>
            <dd>
              The candidate belongs to a different service or approved origin
              and is refused. Unrelated mail alone is not evidence of phishing.
            </dd>
            <dt>BLOCKED — explicit local block</dt>
            <dd>
              A saved block prevents retrieval and fill on that exact origin.
              Removing a block still requires every verification check.
            </dd>
            <dt>SEARCHING — retrieval in progress</dt>
            <dd>
              A bounded search is underway. This operational state is
              unavailable in this build.
            </dd>
            <dt>NO_CODE — no eligible mail</dt>
            <dd>
              No eligible code arrived before the search ended. It is not a
              security decision; a supported flow could offer retry.
            </dd>
            <dt>RECONNECT_REQUIRED — mailbox access unavailable</dt>
            <dd>
              Use the Gmail controls to reconnect. Reconnecting does not enable
              unsupported retrieval.
            </dd>
            <dt>ERROR — operation failed</dt>
            <dd>
              The operation could not complete. No successful fill or connection
              is inferred.
            </dd>
          </dl>
        </details>
      </section>
      <section aria-labelledby="account-title">
        <h2 id="account-title">OTPGuard account</h2>
        <p aria-live="polite">
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
        {!config && (
          <button disabled aria-describedby="account-limit">
            Open account sign-in
          </button>
        )}
        <p id="account-limit" className="muted">
          Account authentication is separate from Gmail consent. Development
          Clerk transport is unsupported.{' '}
          {config
            ? 'Use the configured account host to sign in. Cloud features remain unavailable.'
            : 'Account and cloud features remain unavailable.'}
        </p>
      </section>
      <section aria-labelledby="gmail-title" aria-busy={busy}>
        <h2 id="gmail-title">Gmail mailbox</h2>
        <p>
          OTPGuard sign-in does not grant Gmail access. The mailbox may differ
          from your OTPGuard account.
        </p>
        <p aria-live="polite">
          {mailbox.state === 'CHECKING'
            ? 'Checking Gmail connection…'
            : mailboxText[mailbox.state]}
        </p>
        {mailbox.mailbox && <p>Mailbox: {mailbox.mailbox}</p>}
        {mailbox.state !== 'UNCONFIGURED' && (
          <>
            <p>
              Connect requests read-only access to all Gmail mail. Chrome
              chooses a Google account from this browser profile; confirm the
              mailbox shown below before using it.
            </p>
            <button
              disabled={
                busy ||
                mailbox.state === 'CHECKING' ||
                mailbox.state === 'CONNECTED'
              }
              onClick={() => void mailboxAction('gmail-connect')}
            >
              {mailbox.state === 'RECONNECT_REQUIRED' ||
              mailbox.state === 'SCOPE_REQUIRED'
                ? 'Reconnect Gmail'
                : 'Connect Gmail'}
            </button>
            <button
              disabled={busy || mailbox.state === 'CHECKING'}
              onClick={() => void mailboxAction('gmail-status')}
            >
              Check Gmail connection
            </button>
            <button
              disabled={busy || mailbox.state === 'CHECKING'}
              onClick={() => void mailboxAction('gmail-disconnect')}
            >
              Disconnect Gmail
            </button>
          </>
        )}
      </section>
      <section aria-labelledby="permissions-title">
        <h2 id="permissions-title">Permissions</h2>
        <p>
          {configuredGmail()
            ? 'Gmail read-only access is requested only when you connect. It permits reading all mail; this build uses the mailbox profile for connection status.'
            : 'Local preferences use extension storage. Gmail permission is unconfigured.'}
        </p>
        <p>
          Website access is unavailable. No site detection or injection runs in
          this production build.
        </p>
        <button disabled>Enable on this site</button>
      </section>
      <section aria-labelledby="settings-title" aria-busy={settingsBusy}>
        <h2 id="settings-title">Local settings</h2>
        <label>
          <input
            type="checkbox"
            checked={settings.autofillEnabled ?? false}
            disabled={settingsBusy || settings.state !== 'LOCAL'}
            onChange={(event) => void changeAutofill(event.target.checked)}
          />
          Enable automatic fill for verified requests
        </label>
        <p aria-live="polite">
          {settingsBusy
            ? 'Saving local settings…'
            : settings.state === 'CHECKING'
              ? 'Checking local settings…'
              : settings.state === 'LOCAL'
                ? 'Preferences saved in this browser profile.'
                : 'Local settings unavailable.'}
        </p>
        <p className="muted">
          This saves a preference for future supported requests. Real fill
          remains disabled.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void changeBlock(blockOrigin, true);
          }}
        >
          <label>
            Block access on this HTTPS origin
            <input
              aria-label="HTTPS origin to block"
              maxLength={512}
              aria-describedby="block-help"
              placeholder="https://example.com"
              value={blockOrigin}
              onChange={(event) => setBlockOrigin(event.target.value)}
              disabled={settingsBusy || settings.state !== 'LOCAL'}
            />
          </label>
          <button
            disabled={
              settingsBusy ||
              settings.state !== 'LOCAL' ||
              !canonicalBlock(blockOrigin)
            }
          >
            Block site locally
          </button>
        </form>
        <p id="block-help" className="muted">
          Enter an exact HTTPS origin without a path, query, or fragment. This
          field does not identify your current site.
        </p>
        {settings.state === 'LOCAL' && !settings.blockedOrigins?.length && (
          <p>No sites blocked locally.</p>
        )}
        {(settings.blockedOrigins ?? []).map((origin) => (
          <p key={origin}>
            {origin}{' '}
            <button
              disabled={settingsBusy}
              onClick={() => void changeBlock(origin, false)}
            >
              Remove local block for {origin}
            </button>
          </p>
        ))}
        {settings.state === 'UNAVAILABLE' && (
          <p>Local settings unavailable. Automatic fill stays disabled.</p>
        )}
        <p>
          Cloud settings sync is unconfigured. Local settings remain available.
        </p>
        <p>
          Security checks always apply. Explicit local site blocks take
          precedence.
        </p>
      </section>
      <section aria-labelledby="history-title">
        <h2 id="history-title">Last action &amp; local history</h2>
        <p>
          No current retrieval or fill request is active. Local history reports
          prior outcomes, not a current security verdict or server login
          success.
        </p>
        <p>
          Records expire after seven days, with at most 500 records. This
          browser profile holds its own history. No real fill activity is
          available yet.
        </p>
        <p aria-live="polite">
          {history.state === 'LOCAL'
            ? `${history.count ?? 0} local activity records.`
            : history.state === 'CHECKING'
              ? 'Checking local history…'
              : 'Local history unavailable.'}
        </p>
        {history.state === 'LOCAL' &&
          (history.lastAction ? (
            <p>
              Last recorded action:{' '}
              {history.lastAction.result === 'FILLED'
                ? 'Input filled (login acceptance unknown)'
                : history.lastAction.result === 'CANCELLED'
                  ? 'Request cancelled'
                  : history.lastAction.result === 'ERROR'
                    ? 'Operation failed'
                    : 'Fill refused'}
              . Reason: {activityReason[history.lastAction.reason]}.{' '}
              <time dateTime={new Date(history.lastAction.time).toISOString()}>
                {new Date(history.lastAction.time).toLocaleString()}
              </time>
            </p>
          ) : (
            <p>No recorded fill action.</p>
          ))}
        <button
          disabled={historyBusy || history.state !== 'LOCAL'}
          onClick={() => void historyAction('history-export')}
        >
          Export local history
        </button>
        <button
          disabled={historyBusy || history.state === 'CHECKING'}
          onClick={() => void historyAction('history-delete')}
        >
          Delete local history
        </button>
        {historyExport && (
          <label>
            Local history JSON
            <textarea
              aria-label="Local history JSON"
              readOnly
              value={historyExport}
            />
          </label>
        )}
        <p>
          Cloud activity upload is disabled pending Google policy review and
          cloud configuration. Future cloud history requires explicit opt-in and
          expires after thirty days.
        </p>
      </section>
      <section aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">Dashboard</h2>
        <button disabled aria-describedby="dashboard-limit">
          Open dashboard
        </button>
        <p id="dashboard-limit" className="muted">
          The dashboard is not available yet. Cloud settings sync is
          unconfigured and cloud history upload is disabled.
        </p>
      </section>
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
    'Read-only Gmail permission was not granted. Use Reconnect Gmail to retry.',
  RECONNECT_REQUIRED:
    'Gmail connection needs checking. Use Reconnect Gmail to reconnect.',
  MAILBOX_CHANGED:
    'Google returned a different mailbox. Disconnect first, then connect and confirm the new mailbox.',
  DISCONNECTING: 'Disconnecting Gmail…',
  DISCONNECTED_REVOCATION_UNCONFIRMED:
    'Disconnected locally. Google revocation could not be confirmed. Remove OTPGuard access in your Google account permissions.',
  DISCONNECTED_CACHE_CLEAR_FAILED:
    'Disconnected locally, but Chrome credential cache cleanup failed. Remove OTPGuard access in Google account permissions and retry Disconnect.',
};

const activityReason: Record<ActivityEvent['reason'], string> = {
  none: 'All authorization checks passed',
  'local-block': 'Explicit local site block',
  'unsupported-service': 'Service unsupported',
  destination: 'Candidate targets a different approved origin',
  request: 'Request no longer current',
  ambiguity: 'Multiple plausible candidates or requests',
  sender: 'Sender verification unavailable',
  'message-binding': 'Message does not match this request',
  freshness: 'Candidate too old or receipt time unverified',
  code: 'Unsupported or ambiguous code',
  delivery: 'Input could not be filled safely',
};
