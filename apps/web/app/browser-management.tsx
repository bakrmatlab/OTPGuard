'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@clerk/nextjs';
import { setupProgress } from '../../../packages/shared/setup-progress';
import { sendBrowserAction } from './browser-transport';
import type {
  BrowserAction,
  BrowserSnapshot,
} from '../../../packages/shared/browser-management';
interface BrowserContextValue {
  canConnect: boolean;
  snapshot: BrowserSnapshot | null;
  busy: boolean;
  message: string;
  exportJson: string;
  run(action: BrowserAction): Promise<void>;
}
const BrowserContext = createContext<BrowserContextValue>({
  canConnect: false,
  snapshot: null,
  busy: false,
  message: 'Sign in to connect this browser.',
  exportJson: '',
  run: async () => {},
});
export function BrowserManagement({
  configured,
  children,
}: {
  configured: boolean;
  children: ReactNode;
}) {
  return configured ? (
    <AuthenticatedBrowser>{children}</AuthenticatedBrowser>
  ) : (
    <BrowserContext.Provider
      value={{
        canConnect: false,
        snapshot: null,
        busy: false,
        message: 'Sign in on otpguard.net to connect your installed extension.',
        exportJson: '',
        run: async () => {},
      }}
    >
      {children}
    </BrowserContext.Provider>
  );
}
function AuthenticatedBrowser({ children }: { children: ReactNode }) {
  const { userId, sessionId } = useAuth();
  return (
    <BrowserSession
      key={`${userId}:${sessionId}`}
      userId={userId ?? ''}
      sessionId={sessionId ?? ''}
    >
      {children}
    </BrowserSession>
  );
}
function BrowserSession({
  userId,
  sessionId,
  children,
}: {
  userId: string;
  sessionId: string;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<BrowserSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'Connect your installed extension to manage this Chrome profile here.',
  );
  const [exportJson, setExportJson] = useState('');
  const active = useRef(true);
  const pending = useRef(false);
  const uncertain = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const run = async (action: BrowserAction) => {
    if (pending.current || uncertain.current || !userId || !sessionId) return;
    pending.current = true;
    setBusy(true);
    setMessage('Updating this browser…');
    setExportJson('');
    try {
      const result = await sendBrowserAction(action, userId, sessionId);
      if (!active.current) return;
      if (result.state === 'CONNECTED') {
        setSnapshot(result.snapshot);
        setExportJson(result.exportJson ?? '');
        setMessage(
          action.type === 'open-options'
            ? 'Browser settings opened. Choose Enable website access and approve Chrome’s prompt, then return here.'
            : 'Connected to this Chrome profile. Changes stay in your extension.',
        );
      } else {
        setSnapshot(null);
        setMessage(
          result.state === 'REFUSED'
            ? 'Your session or page changed. Sign in with the same OTPGuard account and reconnect.'
            : result.state === 'BUSY'
              ? 'Another browser action is still running. Try again when it finishes.'
              : 'The extension could not complete this action. Reconnect to check its current state.',
        );
      }
    } catch (error) {
      if (!active.current) return;
      setSnapshot(null);
      if (error instanceof Error && error.message === 'TIMED_OUT') {
        uncertain.current = true;
        setMessage(
          'The action is taking longer than expected. Check the extension and reload this page before trying again.',
        );
      } else
        setMessage(
          'Install or reload the updated OTPGuard extension, then open this dashboard in Chrome at otpguard.net.',
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <BrowserContext.Provider
      value={{
        canConnect: !!userId && !!sessionId,
        snapshot,
        busy: busy || uncertain.current,
        message,
        exportJson,
        run,
      }}
    >
      {children}
    </BrowserContext.Provider>
  );
}
export function BrowserConnection() {
  const { snapshot, busy, message, run, canConnect } =
    useContext(BrowserContext);
  const progress = setupProgress(canConnect, snapshot);
  // Refresh after returning from Chrome's permission screen, only after explicit connection.
  useEffect(() => {
    if (!snapshot) return;
    const refresh = () => {
      if (document.visibilityState === 'visible')
        void run({ type: 'browser-status' });
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [snapshot, run]);
  const ready = progress.action === 'ready';
  const mailboxBlocked = [
    'UNCONFIGURED',
    'SIGN_IN_REQUIRED',
    'ACCOUNT_CHANGED',
    'MAILBOX_CHANGED',
  ].includes(snapshot?.mailbox.state ?? '');
  return (
    <section
      className="browser-connection setup-card"
      aria-labelledby="setup-title"
      aria-busy={busy}
    >
      <p className="context">
        {ready ? 'Setup complete' : `Step ${progress.step} of 4`}
      </p>
      <h2 id="setup-title">{progress.title}</h2>
      <ol className="setup-checklist" aria-label="Setup progress">
        {['Sign in', 'Connect browser', 'Connect Gmail', 'Website access'].map(
          (label, index) => (
            <li
              key={label}
              aria-current={
                !ready && progress.step === index + 1 ? 'step' : undefined
              }
            >
              {index + 1}. {label}
              {ready || index + 1 < progress.step ? ' — Done' : ''}
            </li>
          ),
        )}
      </ol>
      <p>
        {ready
          ? snapshot?.settings.autofillEnabled
            ? 'Open a page asking for an email code. OTPGuard finds it; you click Fill.'
            : 'Automatic finding is off. Open an email-code field and choose Find code in the popup, or turn automatic finding on in Preferences.'
          : progress.action === 'gmail-connect'
            ? 'Choose the mailbox that receives your codes. Gmail permission lets OTPGuard read recent mail.'
            : progress.action === 'open-options'
              ? 'Gmail is connected. Website access is a separate permission that lets OTPGuard detect code fields. We’ll open the extension’s settings; choose Enable website access there.'
              : progress.action === 'browser-status'
                ? 'Connect your installed OTPGuard extension in this Chrome profile.'
                : 'Your OTPGuard account signs you in. Gmail access comes next.'}
      </p>
      {progress.action === 'sign-in' ? (
        <a className="button primary" href="/sign-in">
          Sign in
        </a>
      ) : (
        <button
          className="button primary"
          type="button"
          disabled={busy}
          onClick={() =>
            void run({
              type: ready
                ? 'browser-status'
                : mailboxBlocked && progress.action === 'gmail-connect'
                  ? 'open-options'
                  : progress.action,
            })
          }
        >
          {busy
            ? 'Checking this browser…'
            : ready
              ? 'Refresh browser status'
              : mailboxBlocked && progress.action === 'gmail-connect'
                ? 'Resolve Gmail connection'
                : progress.title}
        </button>
      )}
      {mailboxBlocked && (
        <p>
          {mailboxLabels[snapshot?.mailbox.state ?? '']} Open browser settings
          to resolve it before continuing.
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p className="fine">
        Connecting shares mailbox connection status, preferences, blocked sites
        and your last activity result with this page. Codes, mail and tokens
        stay in the extension.
      </p>
      {progress.action === 'browser-status' && (
        <details>
          <summary>Extension not installed or not responding?</summary>
          <p>
            In Chrome, open chrome://extensions. Load the provided unpacked
            OTPGuard folder, or Reload an existing installation, then return and
            connect. A public store download is not available yet.
          </p>
        </details>
      )}
    </section>
  );
}
export function BrowserMailbox() {
  const { snapshot, busy, run } = useContext(BrowserContext);
  const mailbox = snapshot?.mailbox;
  return (
    <>
      <p role="status">
        {mailbox
          ? (mailboxLabels[mailbox.state] ??
            'Mailbox status could not be checked.')
          : 'Connect this browser above to manage Gmail.'}
      </p>
      {mailbox?.mailbox && <p className="mono">{mailbox.mailbox}</p>}
      <div className="row-actions">
        <button
          className="button primary"
          type="button"
          disabled={
            !snapshot ||
            busy ||
            [
              'CONNECTED',
              'UNCONFIGURED',
              'SIGN_IN_REQUIRED',
              'ACCOUNT_CHANGED',
              'MAILBOX_CHANGED',
            ].includes(mailbox?.state ?? '')
          }
          onClick={() => void run({ type: 'gmail-connect' })}
        >
          {mailbox?.state === 'DISCONNECTED'
            ? 'Connect Gmail'
            : 'Reconnect Gmail'}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={!snapshot || busy}
          onClick={() => {
            if (
              window.confirm(
                'Disconnect Gmail and revoke OTPGuard’s Google project grants? Other OTPGuard Google connections may need consent again.',
              )
            )
              void run({ type: 'gmail-disconnect' });
          }}
        >
          Disconnect Gmail
        </button>
      </div>
      {mailbox?.state === 'DISCONNECTED_REVOCATION_UNCONFIRMED' && (
        <p>
          Disconnected locally. Remove OTPGuard access in Google account
          permissions to confirm revocation.
        </p>
      )}
      {mailbox?.state === 'DISCONNECTED_CACHE_CLEAR_FAILED' && (
        <p>
          Chrome credential cleanup failed. Remove OTPGuard access in Google
          account permissions and retry Disconnect.
        </p>
      )}
      <p className="fine">
        Connecting opens Google consent through the extension. Signing out of
        OTPGuard is separate from disconnecting Gmail.
      </p>
    </>
  );
}
export function BrowserPreferences() {
  const { snapshot, busy, run } = useContext(BrowserContext);
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const available = snapshot?.settings.state === 'LOCAL';
  return (
    <>
      <section className="settings-section">
        <div className="settings-heading">
          <h2>Finding codes</h2>
          <p>
            Find a recent code automatically when an eligible field appears.
            Filling always needs your click.
          </p>
        </div>
        <label className="preference-toggle">
          <input
            type="checkbox"
            checked={snapshot?.settings.autofillEnabled ?? false}
            disabled={!available || busy}
            onChange={(event) =>
              void run({
                type: 'settings-autofill',
                enabled: event.target.checked,
              })
            }
          />{' '}
          Automatic finding
        </label>
        <p>
          Website detection:{' '}
          {snapshot
            ? snapshot.siteAccess
              ? 'Enabled'
              : 'Permission needed'
            : 'Connect this browser first'}
        </p>
        <button
          className="button secondary"
          type="button"
          disabled={!snapshot || busy}
          onClick={() => void run({ type: 'open-options' })}
        >
          {snapshot?.siteAccess
            ? 'Open browser permissions'
            : 'Enable website access'}
        </button>
        <p className="fine">
          Chrome asks for site access in its extension screen. Recent-mail
          matching does not prove that a code belongs to the current website.
        </p>
      </section>
      <section className="settings-section">
        <div className="settings-heading">
          <h2>Blocked sites</h2>
          <p>Block an exact HTTPS origin to stop finding and filling there.</p>
        </div>
        <form
          className="block-form"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const url = new URL(origin.trim());
              if (
                url.protocol !== 'https:' ||
                url.port ||
                url.username ||
                url.password ||
                url.pathname !== '/' ||
                url.search ||
                url.hash
              )
                throw new Error('invalid');
              setError('');
              void run({
                type: 'settings-block',
                origin: url.origin,
                blocked: true,
              });
            } catch {
              setError(
                'Enter an HTTPS site origin, such as https://example.com, without a path or port.',
              );
            }
          }}
        >
          <label>
            Site origin
            <input
              type="url"
              placeholder="https://example.com"
              value={origin}
              maxLength={512}
              disabled={!available || busy}
              onChange={(event) => setOrigin(event.target.value)}
              required
            />
          </label>
          <button
            className="button secondary"
            type="submit"
            disabled={!available || busy}
          >
            Block site
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        {snapshot?.settings.blockedOrigins.length ? (
          <ul className="blocked-list">
            {snapshot.settings.blockedOrigins.map((site) => (
              <li key={site}>
                <span className="mono">{site}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      type: 'settings-block',
                      origin: site,
                      blocked: false,
                    })
                  }
                >
                  Remove block
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {snapshot
              ? 'No blocked sites.'
              : 'Connect this browser to view your blocks.'}
          </p>
        )}
      </section>
    </>
  );
}
export function BrowserActivity() {
  const { snapshot, busy, exportJson, run } = useContext(BrowserContext);
  const history = snapshot?.history;
  const last = history?.lastAction;
  return (
    <>
      <p role="status">
        {history?.state === 'LOCAL'
          ? `${history.count ?? 0} retained local records`
          : snapshot
            ? 'Local activity could not be read. Delete can clear damaged records.'
            : 'Connect this browser to view local activity.'}
      </p>
      {last ? (
        <div className="empty-state">
          <strong>
            Last result: {last.result.replaceAll('_', ' ').toLowerCase()}
          </strong>
          <p>{last.reason.replaceAll('-', ' ')}</p>
          <time dateTime={new Date(last.time).toISOString()}>
            {new Date(last.time).toLocaleString()}
          </time>
        </div>
      ) : (
        history?.state === 'LOCAL' && <p>No retained activity yet.</p>
      )}
      <div className="row-actions">
        <button
          className="button secondary"
          type="button"
          disabled={!snapshot || busy}
          onClick={() => void run({ type: 'history-export' })}
        >
          Export local history
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={!snapshot || busy}
          onClick={() => {
            if (
              window.confirm(
                'Delete all retained activity in this Chrome profile?',
              )
            )
              void run({ type: 'history-delete' });
          }}
        >
          Delete local history
        </button>
      </div>
      {exportJson && (
        <div className="history-export">
          <label>
            Local history JSON
            <textarea readOnly value={exportJson} />
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([exportJson], { type: 'application/json' }),
              );
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'otpguard-local-history.json';
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download JSON
          </button>
        </div>
      )}
      <p className="fine">
        Kept for up to 7 days in this Chrome profile. No codes or mail content.
        Export shares sanitized records with this page only when you request it.
        A filled field does not mean the website accepted the code.
      </p>
    </>
  );
}

const mailboxLabels: Record<string, string> = {
  CONNECTED: 'Gmail connected.',
  DISCONNECTED: 'No mailbox connected.',
  CONNECTING: 'Waiting for Google consent…',
  DISCONNECTING: 'Disconnecting Gmail…',
  SIGN_IN_REQUIRED: 'Sign in to OTPGuard before connecting Gmail.',
  ACCOUNT_CHANGED:
    'Account changed. Disconnect Gmail, then connect for this session.',
  UNCONFIGURED: 'Gmail is not configured in this extension build.',
  CONNECT_FAILED:
    'Google consent was denied or the connection failed. Try reconnecting.',
  SCOPE_REQUIRED:
    'Read-only Gmail permission is needed. Reconnect to grant it.',
  RECONNECT_REQUIRED: 'Reconnect Gmail to restore access.',
  MAILBOX_CHANGED:
    'Google returned a different mailbox. Disconnect first, then reconnect.',
  DISCONNECTED_REVOCATION_UNCONFIRMED:
    'Disconnected locally; Google revocation is unconfirmed.',
  DISCONNECTED_CACHE_CLEAR_FAILED:
    'Disconnected locally; Chrome credential cleanup failed.',
};
