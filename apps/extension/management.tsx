import { useEffect, useRef, useState } from 'react';
import type { ActivityEvent } from '../../packages/shared';
import type { MailboxStatus } from './gmail/lifecycle';
import { configuredGmail } from './gmail/config';
import { configuredAccount } from './account/config';
import { createConnectionQueue } from './account/connection-queue';
import { canonicalBlock } from './settings/local';
import './management.css';
import { setupProgress } from '../../packages/shared/setup-progress';
type Status = { state: string; userId?: string; label?: string };
const unavailableMailbox = (): MailboxStatus => ({
  state: configuredGmail() ? 'RECONNECT_REQUIRED' : 'UNCONFIGURED',
});
export default function Management() {
  const [permission, setPermission] = useState('');
  const [siteAccess, setSiteAccess] = useState<boolean | null>(null);
  useEffect(() => {
    void chrome.permissions
      .contains({ origins: ['https://*/*'] })
      .then(setSiteAccess)
      .catch(() => setSiteAccess(false));
  }, []);
  const enableSites = () =>
    void chrome.permissions
      .request({ origins: ['https://*/*'] })
      .then((granted) => {
        setSiteAccess(granted);
        if (granted && siteAccess !== true) {
          void chrome.runtime
            .sendMessage({ type: 'settings-autofill', enabled: true })
            .then((value) => setSettings(value ?? { state: 'UNAVAILABLE' }))
            .catch(() => setSettings({ state: 'UNAVAILABLE' }));
        }
        setPermission(
          granted
            ? 'Website detection enabled. Reload your login page.'
            : 'Permission denied.',
        );
      })
      .catch(() => setPermission('Permission unavailable.'));

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
  const setup = setupProgress(
    status.state === 'SIGNED_IN',
    {
      mailbox,
      siteAccess: siteAccess === true,
      settings: {
        state: settings.state,
        autofillEnabled: settings.autofillEnabled ?? false,
        blockedOrigins: settings.blockedOrigins ?? [],
      },
    },
    status.state === 'CHECKING' ||
      mailbox.state === 'CHECKING' ||
      siteAccess === null,
  );
  return (
    <main className="management-page">
      <header className="site-header">
        <a
          className="brand"
          href={(config?.webOrigin ?? 'https://otpguard.net') + '/dashboard'}
          target="_blank"
          rel="noreferrer"
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          OTPGuard <span aria-hidden="true">↗</span>
        </a>
        <span className="fine">This browser only</span>
      </header>
      <div className="workspace-content">
        <div className="page-heading">
          <div>
            <h1>Browser settings</h1>
            <p>Control how OTPGuard finds codes.</p>
          </div>
        </div>
        <section className="setup-card" aria-labelledby="setup-title">
          <p className="context">
            {setup.title === 'Checking setup…'
              ? 'Checking setup'
              : setup.action === 'ready'
                ? 'Setup complete'
                : `Step ${setup.step} of 4`}
          </p>
          <h2 id="setup-title">{setup.title}</h2>
          <p>{setup.detail}</p>
          {setup.action === 'sign-in' && (
            <a
              className="button primary"
              href={
                (config?.webOrigin ?? 'https://otpguard.net') + '/dashboard'
              }
              target="_blank"
              rel="noreferrer"
            >
              Sign in
            </a>
          )}
          {setup.title !== 'Checking setup…' &&
            setup.action === 'gmail-connect' && (
              <button
                className="button primary"
                type="button"
                disabled={busy}
                onClick={() => void mailboxAction('gmail-connect')}
              >
                {busy ? 'Connecting…' : setup.title}
              </button>
            )}
          {setup.action === 'open-options' &&
            (mailbox.state === 'CONNECTED' && !siteAccess ? (
              <button
                className="button primary"
                type="button"
                onClick={enableSites}
              >
                Enable website access
              </button>
            ) : (
              <a className="button secondary" href="#connections-title">
                Review browser settings
              </a>
            ))}
          {setup.title !== 'Checking setup…' &&
            setup.action === 'browser-status' && (
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => void mailboxAction('gmail-status')}
              >
                Check connection again
              </button>
            )}
          {permission && <p role="status">{permission}</p>}
          <p className="fine">
            Only choose Fill on a page you intended to use. Recent-mail matching
            does not verify that a code belongs to that website.
          </p>
        </section>
        <section
          className="settings-section"
          aria-labelledby="connections-title"
        >
          <div className="settings-heading">
            <h2 id="connections-title">Connections</h2>
            <p>Your OTPGuard account and Gmail mailbox can be different.</p>
          </div>
          <div className="setting-row">
            <div className="row-copy">
              <h3>OTPGuard account</h3>
              <p role="status">
                {status.state === 'SIGNED_IN'
                  ? (status.label ?? 'Signed in')
                  : status.state === 'CHECKING'
                    ? 'Checking account session…'
                    : status.state === 'UNCONFIGURED'
                      ? 'Account authentication is unconfigured.'
                      : status.state === 'SIGN_OUT_FAILED'
                        ? 'Sign-out failed. Retry or sign out on the website.'
                        : 'Sign in on the website.'}
              </p>
            </div>
            <div className="row-actions">
              {config && (
                <a
                  className="button secondary"
                  href={config.webOrigin + '/sign-in'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {status.state === 'SIGNED_IN' ? 'Manage account' : 'Sign in'}
                </a>
              )}
              {(status.state === 'SIGNED_IN' ||
                status.state === 'SIGN_OUT_FAILED') && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
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
                  Sign out
                </button>
              )}
            </div>
          </div>
          <div className="setting-row" aria-busy={busy}>
            <div className="row-copy">
              <h3>Gmail mailbox</h3>
              <p role="status">
                {mailbox.state === 'CHECKING'
                  ? 'Checking Gmail connection…'
                  : mailbox.state === 'CONNECTED'
                    ? mailbox.mailbox
                    : mailboxText[mailbox.state]}
              </p>
            </div>
            {mailbox.state !== 'UNCONFIGURED' && (
              <div className="row-actions">
                {mailbox.state !== 'CONNECTED' &&
                  (status.state !== 'SIGNED_IN' ||
                    ['CHECKING', 'ACCOUNT_CHANGED', 'MAILBOX_CHANGED'].includes(
                      mailbox.state,
                    )) && (
                    <button
                      className="button primary"
                      type="button"
                      disabled={
                        busy ||
                        mailbox.state === 'CHECKING' ||
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
                  )}
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || mailbox.state === 'CHECKING'}
                  onClick={() => void mailboxAction('gmail-status')}
                >
                  Check connection
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || mailbox.state === 'CHECKING'}
                  onClick={() => void mailboxAction('gmail-disconnect')}
                >
                  Disconnect Gmail
                </button>
              </div>
            )}
          </div>
          <p className="fine">
            Connecting requests read-only access to Gmail. Confirm the mailbox
            shown here. Disconnect attempts project-wide Google revocation and
            clears this extension’s credential cache.
          </p>
        </section>
        <section className="settings-section" aria-labelledby="finding-title">
          <div className="settings-heading">
            <h2 id="finding-title">Finding codes</h2>
            <p>Finding is automatic. Filling always needs your click.</p>
          </div>
          <div className="setting-row">
            <label className="row-copy preference-toggle">
              <input
                ref={automaticInput}
                type="checkbox"
                checked={settings.autofillEnabled ?? false}
                disabled={settingsBusy || settings.state !== 'LOCAL'}
                onChange={(event) => void changeAutofill(event.target.checked)}
              />
              Find codes automatically
              <span>
                Look for a recent code when an eligible field appears.
              </span>
            </label>
          </div>
          <p className="fine" role="status">
            {settingsBusy
              ? 'Saving…'
              : settings.state === 'LOCAL'
                ? 'Saved in this browser.'
                : settings.state === 'CHECKING'
                  ? 'Checking local settings…'
                  : 'Local settings unavailable. Automatic finding stays disabled.'}
          </p>
          <div className="setting-row">
            <div className="row-copy">
              <h3>Website access</h3>
              <p>
                {siteAccess === null
                  ? 'Checking access…'
                  : siteAccess
                    ? 'HTTPS website detection allowed.'
                    : 'Website detection is not enabled.'}
              </p>
            </div>
            {siteAccess === false && mailbox.state !== 'CONNECTED' && (
              <button
                className="button secondary"
                type="button"
                onClick={enableSites}
              >
                Enable website access
              </button>
            )}
          </div>
          <p className="fine">
            A recent code can belong to another sign-in. Fill does not verify
            the sender or its relationship to this website. Only choose Fill on
            a page you intended to use. The page can read the code and may
            continue automatically.
          </p>
        </section>
        <section className="settings-section" aria-labelledby="blocks-title">
          <div className="settings-heading">
            <h2 id="blocks-title">Blocked sites</h2>
            <p>OTPGuard will not search or fill on these sites.</p>
          </div>
          {settings.state === 'LOCAL' && !settings.blockedOrigins?.length && (
            <p className="fine">No sites blocked locally.</p>
          )}
          {(settings.blockedOrigins ?? []).map((origin) => (
            <div className="setting-row blocked-row" key={origin}>
              <div className="row-copy">
                <h3>{origin}</h3>
              </div>
              <button
                className="button secondary"
                type="button"
                disabled={settingsBusy}
                aria-label={`Remove local block for ${origin}`}
                onClick={() => void changeBlock(origin, false)}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="block-form">
            <label htmlFor="block-origin">Block a website</label>
            <div>
              <input
                id="block-origin"
                aria-label="HTTPS origin to block"
                maxLength={512}
                aria-describedby="block-help"
                placeholder="https://example.com"
                value={blockOrigin}
                onChange={(event) => setBlockOrigin(event.target.value)}
                disabled={settingsBusy || settings.state !== 'LOCAL'}
              />
              <button
                className="button secondary"
                type="button"
                disabled={
                  settingsBusy ||
                  settings.state !== 'LOCAL' ||
                  !canonicalBlock(blockOrigin)
                }
                onClick={() => void changeBlock(blockOrigin, true)}
              >
                Add site
              </button>
            </div>
            <p id="block-help" className="fine">
              Use the full HTTPS origin. No paths or wildcards.
            </p>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="history-title">
          <div className="settings-heading">
            <h2 id="history-title">Local activity</h2>
            <p>
              Kept in this browser for up to 7 days. No codes or email content.
            </p>
          </div>
          <p role="status">
            {history.state === 'LOCAL'
              ? `${history.count ?? 0} local activity records.`
              : history.state === 'CHECKING'
                ? 'Checking local history…'
                : 'Local history unavailable.'}
          </p>
          {history.lastAction && (
            <p className="last-action">
              {history.lastAction.result === 'FILLED'
                ? 'Code inserted (login acceptance unknown)'
                : history.lastAction.result === 'CANCELLED'
                  ? 'Request cancelled'
                  : history.lastAction.result === 'ERROR'
                    ? 'Operation failed'
                    : 'Fill refused'}
              . {activityReason[history.lastAction.reason]}.{' '}
              <time dateTime={new Date(history.lastAction.time).toISOString()}>
                {new Date(history.lastAction.time).toLocaleString()}
              </time>
            </p>
          )}
          <div className="row-actions">
            <button
              className="button secondary"
              type="button"
              disabled={historyBusy || history.state !== 'LOCAL'}
              onClick={() => void historyAction('history-export')}
            >
              Export local history
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={historyBusy || history.state === 'CHECKING'}
              onClick={() => void historyAction('history-delete')}
            >
              Delete local history
            </button>
          </div>
          {historyBusy && <p role="status">Updating local history…</p>}
          {historyExport && (
            <label className="history-export">
              Local history JSON
              <textarea
                aria-label="Local history JSON"
                readOnly
                value={historyExport}
              />
            </label>
          )}
          <p className="workspace-footnote">
            Cloud history and settings sync are unavailable.
          </p>
        </section>
        <a
          className="text-link"
          href={(config?.webOrigin ?? 'https://otpguard.net') + '/help'}
          target="_blank"
          rel="noreferrer"
        >
          Help &amp; privacy <span aria-hidden="true">↗</span>
        </a>
      </div>
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
  none: 'User-confirmed insertion checks passed',
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
