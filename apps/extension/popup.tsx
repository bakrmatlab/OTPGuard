import './popup.css';
import type { CancellationReason } from './pipeline/coordinator';
import type { ActivityEvent } from '../../packages/shared';
import { canonicalBlock } from './settings/local';
import type { MailboxStatus } from './gmail/lifecycle';
import { configuredGmail } from './gmail/config';
import { useEffect, useRef, useState } from 'react';
import { configuredAccount } from './account/config';
import { createConnectionQueue } from './account/connection-queue';
const cancellationMessages: Record<CancellationReason, string> = {
  deadline: 'the search time limit was reached.',
  confirmation: 'Fill was not confirmed before the prompt closed or expired.',
  'confirmation-expired':
    'the verified Fill prompt expired before confirmation.',
  'binding-expired': 'the Fill approval expired.',
  'current-changed': 'the current account, mailbox, or page check failed.',
  'prepare-refused': 'the page did not accept preparation for filling.',
  'release-refused': 'the page did not acknowledge insertion.',
  'automatic-disabled': 'automatic prompting was turned off.',
  'account-changed': 'the account session was invalidated.',
  'mailbox-changed': 'the mailbox connection was invalidated.',
  'settings-changed': 'protection settings changed.',
  navigation: 'the page navigated or closed.',
  'tab-changed': 'the active tab changed.',
  'focus-changed':
    'a current account or page check failed after focus changed.',
  'permissions-changed': 'site permissions changed.',
  'page-cancelled': 'the page cancelled its current handoff.',
  invalidated: 'the request was invalidated.',
};
type Status = { state: string; userId?: string; label?: string };
const unavailableMailbox = (): MailboxStatus => ({
  state: configuredGmail() ? 'RECONNECT_REQUIRED' : 'UNCONFIGURED',
});
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  if (
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    message &&
    typeof message === 'object' &&
    Object.keys(message).length === 1 &&
    'type' in message &&
    message.type === 'popup-focus-check'
  )
    reply(document.hasFocus());
});
export default function Popup() {
  const [pipeline, setPipeline] = useState<{
    state: string;
    requestId?: string;
    cancellation?: CancellationReason;
    prompt?: 'requested' | 'unavailable' | 'manual';
  }>({ state: 'IDLE' });
  const [permission, setPermission] = useState('');
  useEffect(() => {
    let active = true;
    const read = () =>
      void chrome.runtime
        .sendMessage({ type: 'pipeline-status' })
        .then((v) => {
          if (active && v) setPipeline(v);
        })
        .catch(() => {});
    read();
    const timer = setInterval(read, 500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const [status, setStatus] = useState<Status>({ state: 'CHECKING' });
  const [probe, setProbe] = useState('');
  const probeGeneration = useRef(0);
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
  const automaticInput = useRef<HTMLInputElement>(null);
  const restoreAutomaticFocus = useRef(false);
  useEffect(() => {
    if (!settingsBusy && restoreAutomaticFocus.current) {
      restoreAutomaticFocus.current = false;
      if (document.activeElement === document.body)
        automaticInput.current?.focus();
    }
  }, [settingsBusy]);
  const changeAutofill = async (enabled: boolean) => {
    restoreAutomaticFocus.current =
      document.activeElement === automaticInput.current;
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
  const [connectionQueue] = useState(createConnectionQueue);
  const mailboxAction = async (type: string) => {
    if (
      type === 'gmail-disconnect' &&
      !window.confirm(
        'Google revocation removes this account’s grants for all OAuth clients in the OTPGuard Google project. The old Gmail extension and future Google sign-in may need consent again. Disconnect and revoke?',
      )
    )
      return;
    setBusy(true);
    if (type === 'gmail-connect') setMailbox({ state: 'CONNECTING' });
    if (type === 'gmail-disconnect') setMailbox({ state: 'DISCONNECTING' });
    try {
      setMailbox(
        (await connectionQueue.run(() =>
          chrome.runtime.sendMessage({ type }),
        )) ?? unavailableMailbox(),
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
      if (connectionQueue.busy()) return;
      void connectionQueue
        .run(async () => ({
          account: await chrome.runtime.sendMessage({ type: 'account-status' }),
          mailbox: await chrome.runtime.sendMessage({ type: 'gmail-status' }),
        }))
        .then((value: { account: Status; mailbox: MailboxStatus }) => {
          if (active) {
            setStatus(value.account ?? { state: 'SIGN_IN_REQUIRED' });
            setMailbox(value.mailbox ?? unavailableMailbox());
          }
        })
        .catch(() => {
          if (active) {
            setStatus({ state: 'SIGN_IN_REQUIRED' });
            setMailbox(unavailableMailbox());
          }
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
    const timer = setInterval(refresh, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connectionQueue]);
  const openConnectionPanel = () => {
    const management =
      document.querySelector<HTMLDetailsElement>('details.management');
    const summary = document.getElementById(
      status.state === 'SIGNED_IN' ? 'gmail-summary' : 'account-summary',
    );
    if (management) management.open = true;
    if (summary?.parentElement instanceof HTMLDetailsElement)
      summary.parentElement.open = true;
    summary?.focus();
  };
  return (
    <main>
      <header>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            O
          </span>
          <h1>OTPGuard</h1>
          <span className="pilot">Local protection</span>
        </div>
        <p className="muted">Email codes, checked locally.</p>
      </header>
      <section aria-labelledby="protection-title" className="protection">
        <p className="eyebrow">Current request</p>
        <h2 id="protection-title">
          {requestTitle[pipeline.state] ?? 'Request unavailable'}
        </h2>
        {pipeline.state === 'READY' && pipeline.prompt === 'unavailable' && (
          <p role="status">
            Chrome could not open the automatic prompt. Fill is still available
            here until this approval expires.
          </p>
        )}
        <p role="status" aria-live="polite">
          {pipeline.state === 'CANCELLED' && pipeline.cancellation
            ? `Request cancelled: ${cancellationMessages[pipeline.cancellation]}`
            : (requestText[pipeline.state] ??
              'Reopen the popup or try again on a supported login page.')}
        </p>
        <div className="actions">
          <button
            className="primary"
            disabled={pipeline.state !== 'READY'}
            onClick={() =>
              void chrome.runtime
                .sendMessage({
                  type: 'pipeline-fill',
                  requestId: pipeline.requestId,
                })
                .then(() => setPipeline({ state: 'SEARCHING' }))
                .catch(() => setPipeline({ state: 'ERROR' }))
            }
          >
            Fill
          </button>
          <button
            onClick={() =>
              void chrome.runtime
                .sendMessage({ type: 'pipeline-retry' })
                .then((v) =>
                  setPipeline({ state: v ? 'SEARCHING' : 'UNAVAILABLE' }),
                )
                .catch(() => setPipeline({ state: 'ERROR' }))
            }
          >
            Find code / Retry
          </button>
        </div>
        <p className="muted fill-note">
          OTPGuard never submits. The site may react to input events.
        </p>
        <details>
          <summary>How protection works</summary>
          <p>
            Currently supports Canva email-code login only. Signed sender and
            content are checked locally. Direct delivery and intact-copy replay
            are not proven. Every insertion requires your click. A verified
            approval lasts at most 30 seconds; expired approvals require a new
            search.
          </p>
          <dl>
            <dt>VERIFIED — authorized request</dt>
            <dd>
              All checks pass. Only a current, worker-authorized request can
              fill after your click.
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
            <dd>A bounded search is underway.</dd>
            <dt>NO_CODE — no eligible mail</dt>
            <dd>
              No eligible code arrived before the search ended. It is not a
              security decision; a supported flow could offer retry.
            </dd>
            <dt>RECONNECT_REQUIRED — mailbox access unavailable</dt>
            <dd>
              Use the Gmail controls to reconnect. Only supported sites can
              retrieve.
            </dd>
            <dt>ERROR — operation failed</dt>
            <dd>
              The operation could not complete. No successful fill or connection
              is inferred.
            </dd>
          </dl>
        </details>
      </section>
      <section className="connection-summary" aria-label="Connection overview">
        <p>
          <span>OTPGuard account</span>
          <strong>
            {status.state === 'SIGNED_IN'
              ? (status.label ?? 'Signed in')
              : status.state === 'CHECKING'
                ? 'Checking account session…'
                : 'Sign-in needed'}
          </strong>
        </p>
        <p>
          <span>Gmail mailbox</span>
          <strong>
            {mailbox.state === 'CHECKING'
              ? 'Checking Gmail connection…'
              : mailbox.state === 'CONNECTED'
                ? mailbox.mailbox
                : mailboxText[mailbox.state]}
          </strong>
        </p>
        <button className="connection-link" onClick={openConnectionPanel}>
          {status.state === 'CHECKING' || mailbox.state === 'CHECKING'
            ? 'View connections'
            : status.state !== 'SIGNED_IN'
              ? 'Set up your account'
              : mailbox.state !== 'CONNECTED'
                ? 'Resolve Gmail connection'
                : 'Manage connections'}
        </button>
      </section>
      <details className="management">
        <summary>Connections, preferences &amp; history</summary>
        <section aria-labelledby="account-title">
          <details className="panel">
            <summary id="account-summary">Account details</summary>
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
            {status.userId && (
              <details className="support-detail">
                <summary>Account reference</summary>
                <p>Account ID: {status.userId}</p>
              </details>
            )}
            <div className="account-actions">
              {config && (
                <a
                  href={config.webOrigin + '/sign-in'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open account sign-in
                </a>
              )}
              {(status.state === 'SIGNED_IN' ||
                status.state === 'SIGN_OUT_FAILED') && (
                <button
                  onClick={() => {
                    probeGeneration.current++;
                    setProbe('');
                    setStatus({ state: 'CHECKING' });
                    setMailbox({ state: 'SIGN_IN_REQUIRED' });
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
            </div>
            <details className="support-detail">
              <summary>Cloud identity check</summary>
              {status.state === 'SIGNED_IN' && (
                <button
                  onClick={() => {
                    const generation = ++probeGeneration.current;
                    setProbe('Checking cloud identity…');
                    void connectionQueue
                      .run(() =>
                        chrome.runtime.sendMessage({ type: 'account-probe' }),
                      )
                      .then((value) => {
                        if (probeGeneration.current !== generation) return;
                        setProbe(
                          value?.state === 'IDENTITY_VERIFIED'
                            ? 'Cloud identity verified for this check. Metadata sync remains disabled.'
                            : 'Cloud identity could not be verified. Check configuration and sign in again.',
                        );
                      })
                      .catch(() => {
                        if (probeGeneration.current === generation)
                          setProbe('Cloud identity could not be verified.');
                      });
                  }}
                >
                  Check cloud identity
                </button>
              )}
              {probe && <p aria-live="polite">{probe}</p>}
            </details>
            <p id="account-limit" className="muted">
              Your OTPGuard account is separate from Gmail access.{' '}
              {config
                ? 'Sign in on the website, then reopen this popup. Website and extension share this session; signing out applies to both.'
                : 'Account and cloud features remain unavailable.'}
            </p>
          </details>
        </section>
        <section aria-labelledby="gmail-title" aria-busy={busy}>
          <details className="panel">
            <summary id="gmail-summary">Gmail connection</summary>
            <h2 id="gmail-title">Gmail mailbox</h2>
            <p>
              OTPGuard sign-in does not grant Gmail access. The mailbox may
              differ from your OTPGuard account.
            </p>
            <p aria-live="polite">
              {mailbox.state === 'CHECKING'
                ? 'Checking mailbox access…'
                : mailboxText[mailbox.state]}
            </p>
            {mailbox.mailbox && <p>Mailbox: {mailbox.mailbox}</p>}
            {mailbox.state !== 'UNCONFIGURED' && (
              <>
                <p className="permission-notice">
                  Connecting grants read-only access to all Gmail mail. Chrome
                  chooses an account from this browser profile; confirm the
                  mailbox shown here.
                </p>
                <details className="support-detail">
                  <summary>Consent &amp; reconnecting</summary>
                  <p>
                    Google may reuse an existing project grant without showing
                    new consent. After Connect, OTPGuard remembers this
                    account/mailbox binding and checks Chrome’s existing grant
                    after restart. It never opens consent automatically; changed
                    or unavailable authority requires reconnection.
                  </p>
                </details>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    mailbox.state === 'CHECKING' ||
                    mailbox.state === 'CONNECTED' ||
                    mailbox.state === 'ACCOUNT_CHANGED' ||
                    status.state !== 'SIGNED_IN'
                  }
                  onClick={() => void mailboxAction('gmail-connect')}
                >
                  {mailbox.state === 'RECONNECT_REQUIRED' ||
                  mailbox.state === 'SCOPE_REQUIRED'
                    ? 'Reconnect Gmail'
                    : 'Connect Gmail'}
                </button>
                <p className="muted">
                  Disconnect attempts project-wide Google revocation for this
                  mailbox, including other OTPGuard clients. It also clears this
                  extension’s Chrome token cache.
                </p>
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
          </details>
        </section>
        <section aria-labelledby="permissions-title">
          <details className="panel">
            <summary id="permissions-summary">Site access</summary>
            <h2 id="permissions-title">Permissions</h2>
            <p>
              {configuredGmail()
                ? 'Gmail read-only access is requested only when you connect. It permits reading all mail; only bounded recent supported-sender mail is retrieved for a current request.'
                : 'Local preferences use extension storage. Gmail permission is unconfigured.'}
            </p>
            <p>
              Optional access applies only to https://www.canva.com. Enable it,
              then reload the Canva login page. DNS key lookup sends only the
              public signer/selector to Google Public DNS.
            </p>
            <button
              onClick={() =>
                void chrome.permissions
                  .request({ origins: ['https://www.canva.com/*'] })
                  .then((v) =>
                    setPermission(
                      v
                        ? 'Canva enabled. Reload its page.'
                        : 'Permission denied.',
                    ),
                  )
                  .catch(() => setPermission('Permission unavailable.'))
              }
            >
              Enable Canva
            </button>
            {permission && <p role="status">{permission}</p>}
          </details>
        </section>
        <section aria-labelledby="settings-title" aria-busy={settingsBusy}>
          <details className="panel">
            <summary id="settings-summary">Preferences & site blocks</summary>
            <h2 id="settings-title">Local settings</h2>
            <label className="preference-toggle">
              <input
                type="checkbox"
                ref={automaticInput}
                checked={settings.autofillEnabled ?? false}
                disabled={settingsBusy || settings.state !== 'LOCAL'}
                onChange={(event) => void changeAutofill(event.target.checked)}
              />
              Automatically find codes and show the Fill prompt
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
              When off, use Find code / Retry. The same verification checks
              apply.
            </p>
            <h3>Blocked sites</h3>
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
              Enter an exact HTTPS origin without a path, query, or fragment.
              This field does not identify your current site.
            </p>
            {settings.state === 'LOCAL' && !settings.blockedOrigins?.length && (
              <p>No sites blocked locally.</p>
            )}
            {(settings.blockedOrigins ?? []).map((origin) => (
              <div className="blocked-site" key={origin}>
                <span>{origin}</span>{' '}
                <button
                  disabled={settingsBusy}
                  aria-label={`Remove local block for ${origin}`}
                  onClick={() => void changeBlock(origin, false)}
                >
                  Remove local block
                </button>
              </div>
            ))}
            {settings.state === 'UNAVAILABLE' && (
              <p>Local settings unavailable. Automatic fill stays disabled.</p>
            )}
            <p>
              Cloud settings sync is unconfigured. Local settings remain
              available.
            </p>
            <p>
              Security checks always apply. Explicit local site blocks take
              precedence.
            </p>
          </details>
        </section>
        <section aria-labelledby="history-title">
          <details className="panel">
            <summary id="history-summary">Local history</summary>
            <h2 id="history-title">Last action &amp; local history</h2>
            <p>
              Local history reports prior outcomes, not a current security
              verdict or server login success.
            </p>
            <p className="muted">
              Saved in this browser only · retained for seven days · up to 500
              records.
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
                <p className="last-action">
                  Last recorded action:{' '}
                  {history.lastAction.result === 'FILLED'
                    ? 'Input filled (login acceptance unknown)'
                    : history.lastAction.result === 'CANCELLED'
                      ? 'Request cancelled'
                      : history.lastAction.result === 'ERROR'
                        ? 'Operation failed'
                        : 'Fill refused'}
                  . Reason: {activityReason[history.lastAction.reason]}.{' '}
                  <time
                    dateTime={new Date(history.lastAction.time).toISOString()}
                  >
                    {new Date(history.lastAction.time).toLocaleString()}
                  </time>
                </p>
              ) : (
                <p className="empty-history">No recorded fill action.</p>
              ))}
            <button
              aria-busy={historyBusy}
              disabled={historyBusy || history.state !== 'LOCAL'}
              onClick={() => void historyAction('history-export')}
            >
              Export local history
            </button>
            <button
              className="destructive"
              aria-busy={historyBusy}
              disabled={historyBusy || history.state === 'CHECKING'}
              onClick={() => void historyAction('history-delete')}
            >
              Delete local history
            </button>
            {historyBusy && <p role="status">Updating local history…</p>}
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
              cloud configuration. Future cloud history requires explicit opt-in
              and expires after thirty days.
            </p>
          </details>
        </section>
        <section aria-labelledby="dashboard-title">
          <details className="panel">
            <summary id="dashboard-summary">Build & dashboard</summary>
            <h2 id="dashboard-title">Build identity</h2>
            <p>
              Popup polish · Core 4 engine · v
              {chrome.runtime.getManifest().version}
            </p>
            <p className="muted">Extension ID: {chrome.runtime.id}</p>
            <h2>Dashboard</h2>
            <button disabled aria-describedby="dashboard-limit">
              Open dashboard
            </button>
            <p id="dashboard-limit" className="muted">
              The dashboard is not available yet. Cloud settings sync is
              unconfigured and cloud history upload is disabled.
            </p>
          </details>
        </section>
      </details>
    </main>
  );
}

const mailboxText: Record<MailboxStatus['state'], string> = {
  SIGN_IN_REQUIRED:
    'Sign in to OTPGuard before connecting or checking Gmail. Disconnect remains available.',
  ACCOUNT_CHANGED:
    'The OTPGuard session changed. Disconnect Gmail first, then connect explicitly for this session.',
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

const requestTitle: Record<string, string> = {
  IDLE: 'Ready when you need a code',
  READY: 'Your code is ready',
  SEARCHING: 'Looking for your code',
  FILLED: 'Code inserted',
  CANCELLED: 'Request stopped',
  NO_CODE: 'No eligible code found',
  UNKNOWN: 'Could not verify this request',
  MISMATCH: 'Destination does not match',
  BLOCKED: 'This site is blocked',
  ERROR: 'Could not complete the request',
  UNAVAILABLE: 'Request unavailable',
};
const requestText: Record<string, string> = {
  IDLE: 'Open a supported email-code challenge, or choose Find code / Retry.',
  READY: 'Code verified for this request. Click Fill before approval expires.',
  SEARCHING:
    'Searching recent verification mail… Late mail is checked during this bounded search.',
  FILLED:
    'Code inserted. Continue on the site to complete login. Insertion does not confirm login.',
  CANCELLED:
    'The request is no longer active. Return to the email-code challenge and retry.',
  NO_CODE:
    'No eligible mail arrived during the search. Wait for the email, then retry.',
  UNKNOWN:
    'Evidence is unsupported, insufficient or ambiguous. No code is released; this does not mean the site is malicious.',
  MISMATCH:
    'The candidate targets a different approved destination. No code is released.',
  BLOCKED:
    'An explicit local site block prevents retrieval and fill. Manage it in Preferences & site blocks.',
  ERROR:
    'The operation failed. No successful fill is confirmed. Return to the challenge and retry.',
};
