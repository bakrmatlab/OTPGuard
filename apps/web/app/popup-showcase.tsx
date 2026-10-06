import React from 'react';
import { BrandMark } from './site';

/** Static public examples. All actions lead to the isolated synthetic Fill demo. */
export function PopupShowcase() {
  const states = [
    {
      label: 'Ready',
      title: 'Ready to find',
      detail: 'Open an email code field.',
      action: 'Find code',
    },
    {
      label: 'Searching',
      title: 'Finding a code…',
      detail: 'Checking recent email.',
    },
    { label: 'Code found', title: 'Code found', action: 'Fill' },
    {
      label: 'No code',
      title: 'No code found',
      detail: 'Request a new code, then retry.',
      action: 'Retry',
    },
  ];
  return (
    <section
      id="extension"
      className="popup-review"
      aria-labelledby="extension-title"
    >
      <div className="page-heading">
        <div>
          <p className="context">Extension</p>
          <h2 id="extension-title">Just the current action.</h2>
          <p>Four states. One place for everything else.</p>
        </div>
        <span className="demo-label">Synthetic states</span>
      </div>
      <div className="popup-grid">
        {states.map((state) => (
          <article className="popup-case" key={state.label}>
            <h3>{state.label}</h3>
            <div className="popup">
              <div className="popup-brand">
                <BrandMark />
                OTPGuard
              </div>
              <div className="popup-status">
                {state.label === 'Searching' ? (
                  <span className="search-indicator" aria-hidden="true" />
                ) : state.action === 'Fill' ? (
                  <span className="status-dot" aria-hidden="true" />
                ) : null}
                {state.title}
              </div>
              {state.detail && <p>{state.detail}</p>}
              {state.action && (
                <a
                  className={`button ${state.action === 'Fill' ? 'primary' : 'secondary'}`}
                  href="#demo"
                  aria-label={`${state.action} — try the synthetic demo`}
                >
                  {state.action}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
              {state.label === 'Searching' && (
                <div className="search-track" aria-hidden="true">
                  <span />
                </div>
              )}
              <a className="popup-site" href="/dashboard">
                Open OTPGuard <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="popup-notes">
        <p>
          No code preview, copy action, account panel or preferences inside the
          popup.
        </p>
        <p>
          These are examples. Try the actions in the synthetic demo above. Your
          real extension shows one current state.
        </p>
      </div>
    </section>
  );
}
