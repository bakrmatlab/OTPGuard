import { popupPresentation, type PopupSnapshot } from './popup-state';
export type { PopupSnapshot } from './popup-state';
export function PopupView({
  pipeline,
  account,
  siteAccess,
  website,
  onFill,
  onRetry,
  onSetup,
}: {
  pipeline: PopupSnapshot;
  account: string;
  siteAccess: boolean | null;
  website: string;
  onFill: () => void;
  onRetry: () => void;
  onSetup?: () => void;
}) {
  const view = popupPresentation(pipeline, account, siteAccess);
  const setupLabel =
    account === 'CHECKING'
      ? null
      : account !== 'SIGNED_IN' || pipeline.state === 'ACCOUNT_UNAVAILABLE'
        ? 'Sign in'
        : view.title === 'Website access needed'
          ? 'Enable website access'
          : pipeline.state === 'MAILBOX_UNAVAILABLE' ||
              pipeline.retrievalIssue === 'mailbox'
            ? 'Connect Gmail'
            : null;
  return (
    <main className="popup">
      <header className="popup-brand">
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h1>OTPGuard</h1>
      </header>
      <section aria-labelledby="current-status" aria-busy={view.busy}>
        <h2 className="popup-status" id="current-status">
          {view.busy ? (
            <span className="search-indicator" aria-hidden="true" />
          ) : view.fill ? (
            <span className="status-dot" aria-hidden="true" />
          ) : null}
          {view.title}
        </h2>
        <p role="status">{view.detail}</p>
        {setupLabel &&
          (setupLabel === 'Sign in' ? (
            <a
              className="button primary"
              href={website}
              target="_blank"
              rel="noreferrer"
            >
              Sign in
            </a>
          ) : (
            <button className="button primary" type="button" onClick={onSetup}>
              {setupLabel}
            </button>
          ))}
        {view.fill && (
          <button className="button primary" type="button" onClick={onFill}>
            Fill <span aria-hidden="true">↗</span>
          </button>
        )}
        {view.retry && (
          <button className="button secondary" type="button" onClick={onRetry}>
            {pipeline.state === 'EMAIL_CONFIRMATION_REQUIRED'
              ? 'This is an email code'
              : pipeline.state === 'IDLE'
                ? 'Find code'
                : 'Retry'}{' '}
            <span aria-hidden="true">↗</span>
          </button>
        )}
        {view.busy && (
          <div className="search-track" aria-hidden="true">
            <span />
          </div>
        )}
      </section>
      <a className="popup-site" href={website} target="_blank" rel="noreferrer">
        Browser settings <span aria-hidden="true">↗</span>
      </a>
    </main>
  );
}
