import React, { type ReactNode } from 'react';
import { Workspace, WorkspaceNavigation } from './workspace';
import { supportedServices } from '../../../packages/security';
import {
  providerReportLabel,
  type Installation,
} from '../../../packages/shared';

/** Presentation only: no browser storage, provider SDK or cloud transport. */
export type ReportState =
  | { kind: 'unconfigured' | 'loading' | 'error' | 'opt-out' }
  | {
      kind: 'ready';
      installations: readonly Installation[];
      observedAt: number;
    };
const sections = [
  ['overview', 'Overview'],
  ['connections', 'Account & connections'],
  ['activity', 'Activity'],
  ['settings', 'Settings'],
  ['services', 'Supported sites'],
] as const;
function Panel({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={-1}
      className="panel"
      aria-labelledby={`${id}-title`}
    >
      <div className="panel-heading">
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
export function DeviceReports({ state }: { state: ReportState }) {
  if (state.kind !== 'ready') {
    const messages = {
      unconfigured: [
        'Device reports unavailable',
        'Cloud metadata transport is unconfigured. No device connection status has been read.',
      ],
      loading: [
        'Checking device reports…',
        'Connection status is unknown while account-scoped reports load.',
      ],
      error: [
        'Device reports could not be loaded',
        'Connection status is unknown. A failed read does not mean Gmail is disconnected.',
      ],
      'opt-out': [
        'Device reporting is off',
        'No synchronized reports are being read. Your local extension remains separate.',
      ],
    };
    const [title, detail] = messages[state.kind];
    return (
      <div
        className="empty-state"
        role="status"
        aria-busy={state.kind === 'loading'}
      >
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    );
  }
  if (!state.installations.length)
    return (
      <div className="empty-state">
        <strong>No device reports yet</strong>
        <p>
          No installation has reported to this account. This does not tell us
          whether an extension is installed locally.
        </p>
      </div>
    );
  return (
    <ul className="report-list">
      {state.installations.map((report, index) => {
        const validTime =
          Number.isSafeInteger(report.lastSeenAt) &&
          report.lastSeenAt >= 0 &&
          Number.isFinite(state.observedAt) &&
          report.lastSeenAt <= state.observedAt &&
          report.lastSeenAt <= 8.64e15;
        const age = validTime
          ? Math.floor((state.observedAt - report.lastSeenAt) / 60_000)
          : null;
        return (
          <li key={report.installationId}>
            <strong>Installation {index + 1}</strong>
            <p className="mono">{report.installationId}</p>
            <p>
              {validTime
                ? providerReportLabel(report, state.observedAt)
                : 'Device report time unavailable; current Gmail connection unknown.'}
            </p>
            <p className="muted">
              {age === null
                ? 'Last report time unavailable'
                : `Last reported ${age === 0 ? 'less than a minute' : `${age} minute${age === 1 ? '' : 's'}`} ago`}
              {validTime && (
                <>
                  {' '}
                  ·{' '}
                  <time dateTime={new Date(report.lastSeenAt).toISOString()}>
                    {new Date(report.lastSeenAt)
                      .toISOString()
                      .replace('T', ' ')
                      .replace('.000Z', ' UTC')}
                  </time>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
export function ActivityState({
  kind,
}: {
  kind: 'unconfigured' | 'loading' | 'error' | 'opt-out' | 'empty';
}) {
  const messages = {
    unconfigured: [
      'Cloud activity unavailable',
      'Cloud activity upload is disabled pending policy review, and transport is unconfigured. No cloud history has been read.',
    ],
    loading: [
      'Checking cloud activity…',
      'Only activity synchronized for the authenticated account could appear here.',
    ],
    error: [
      'Cloud activity could not be loaded',
      'History is unavailable. A failed read does not mean there were no actions.',
    ],
    'opt-out': [
      'Cloud history is off',
      'Local activity is not uploaded automatically. Opting in would never upload a backlog.',
    ],
    empty: [
      'No retained cloud activity',
      'There are no synchronized records in the retention window. This is not proof that no local actions occurred.',
    ],
  };
  const [title, detail] = messages[kind];
  return (
    <div className="empty-state" role="status" aria-busy={kind === 'loading'}>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
export function Dashboard({ account }: { account?: ReactNode }) {
  return (
    <Workspace>
      <a className="skip-link" href="#main">
        Skip to dashboard
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="OTPGuard overview">
          <span className="brand-mark" aria-hidden="true">
            O
          </span>
          OTPGuard
        </a>
        <p className="nav-label">YOUR WORKSPACE</p>
        <WorkspaceNavigation sections={sections} />
        <div className="sidebar-note">
          <span className="status-dot" aria-hidden="true" />
          Local-first by design<p>Mail and codes stay out of this dashboard.</p>
        </div>
      </aside>
      <main id="main" className="dashboard-main" tabIndex={-1}>
        <header className="topbar">
          <span>OTPGuard / Workspace</span>
          <span className="badge">Browser-first protection</span>
        </header>
        <section
          id="overview"
          aria-labelledby="overview-title"
          className="overview"
          tabIndex={-1}
        >
          <p className="eyebrow">ACCOUNT & SECURITY</p>
          <div className="overview-heading">
            <h1 id="overview-title">Overview</h1>
            <a className="account-link" href="#connections">
              Manage account
            </a>
          </div>
          <p className="intro">
            Manage your account here. Find and fill verification codes with the
            extension.
          </p>
          <div className="capability-notice">
            <span className="notice-symbol" aria-hidden="true">
              i
            </span>
            <div>
              <strong>Your extension does the work</strong>
              <p>
                The extension checks email codes locally and fills only after
                your click. Cloud metadata is not connected to this dashboard.
              </p>
            </div>
          </div>
          <div className="summary-grid">
            <a className="summary-card" href="#connections">
              <p>Account</p>
              <strong>Account &amp; connections</strong>
              <span>Sign in or manage your shared session</span>
            </a>
            <a className="summary-card" href="#services">
              <p>Coverage</p>
              <strong>{supportedServices.length} pilot service</strong>
              <span>See supported sites and exact origins</span>
            </a>
            <a className="summary-card" href="#settings">
              <p>Preferences</p>
              <strong>Make it work for you</strong>
              <span>Find prompts, site access and local controls</span>
            </a>
          </div>
          <section className="getting-started" aria-labelledby="start-title">
            <h2 id="start-title">Ready to use OTPGuard?</h2>
            <ol>
              <li>
                <strong>Connect your mailbox</strong>
                <span>
                  Open the extension and connect Gmail. Website sign-in does not
                  grant mailbox access.
                </span>
              </li>
              <li>
                <strong>Enable a supported site</strong>
                <span>
                  Grant site access in the extension, then open a fresh
                  email-code challenge.
                </span>
              </li>
              <li>
                <strong>Review and fill</strong>
                <span>
                  When a code is verified, click Fill. Complete your login on
                  the site.
                </span>
              </li>
            </ol>
            <a href="#services">Check supported sites</a>
          </section>
        </section>
        <div className="content-grid">
          <Panel id="connections" title="Connected accounts">
            <div className="account-row">
              <span className="avatar" aria-hidden="true">
                O
              </span>
              <div>
                <h3>OTPGuard account</h3>
                {account ?? (
                  <>
                    <p>Account authentication is unconfigured.</p>
                    <p className="muted">
                      Account features are unavailable in this setup. Your
                      extension connection is managed separately.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="divider" />
            <h3>Gmail · reported by devices</h3>
            <p>
              A Gmail grant belongs to one Chrome profile and installation. Your
              OTPGuard identity and Gmail mailbox may differ.
            </p>
            <p className="muted">
              The dashboard receives provider status only, never mailbox
              addresses or Gmail credentials. Connect, check or disconnect Gmail
              in the extension.
            </p>
            <div className="inline-note">
              No synchronized connection report available. This does not mean
              your local mailbox is disconnected.
            </div>
            <details className="secondary-details">
              <summary>Device reports</summary>
              <DeviceReports state={{ kind: 'unconfigured' }} />
              <p>
                Device reports are not connected here. A missing report does not
                mean your local extension is disconnected.
              </p>
            </details>
          </Panel>
          <Panel id="activity" title="Activity">
            <ActivityState kind="unconfigured" />
            <p>
              The dashboard cannot read unsynchronized extension-local activity.
              View, export or delete that history in the extension popup.
            </p>
            <div className="retention">
              <span>
                Local history<strong>7 days · browser profile</strong>
              </span>
              <span>
                Cloud history, if enabled<strong>30 days · optional</strong>
              </span>
            </div>
            <details className="secondary-details">
              <summary>History retention details</summary>
              <p className="muted">
                Local history can span OTPGuard account changes. Retention is
                applied when the extension runs or history is accessed; inactive
                stored bytes may remain longer. A recorded fill means input
                insertion, not server login acceptance.
              </p>
            </details>
            <details className="secondary-details">
              <summary>Cloud history availability</summary>
              <button disabled aria-describedby="cloud-history-help">
                Enable cloud history
              </button>
              <p id="cloud-history-help" className="control-help">
                Unavailable until policy and authenticated transport
                requirements are resolved. No history is uploaded from this
                page.
              </p>
            </details>
          </Panel>
          <Panel id="settings" title="Settings">
            <div className="setting-row">
              <div>
                <h3>Automatic code prompts</h3>
                <p>
                  Open the extension → Connections, preferences & history →
                  Preferences & site blocks. Turn automatic prompts on or off
                  there. Its current value is not available here.
                </p>
              </div>
              <span className="badge">Local only</span>
            </div>
            <div className="setting-row">
              <div>
                <h3>Site access &amp; blocks</h3>
                <p>
                  Use Site access in the extension to enable a supported site.
                  Use Preferences &amp; site blocks to block an exact origin or
                  remove an existing block.
                </p>
              </div>
              <a href="#services">Supported sites</a>
            </div>
            <div className="setting-row">
              <div>
                <h3>Local history</h3>
                <p>
                  View, export or delete records in the extension’s Local
                  history panel. Codes and mail are never included.
                </p>
              </div>
              <a href="#activity">History details</a>
            </div>
            <details className="secondary-details">
              <summary>Cloud settings availability</summary>
              <div className="setting-row">
                <div>
                  <h3>Account settings sync</h3>
                  <p>
                    Cloud settings sync is unconfigured. Local preferences
                    remain usable independently.
                  </p>
                </div>
                <button disabled aria-describedby="settings-help">
                  Enable sync
                </button>
              </div>
              <p id="settings-help" className="control-help">
                No settings are read or changed by this dashboard.
              </p>
            </details>
            <div className="inline-note">
              <strong>Security enforcement is always required.</strong>{' '}
              Automatic and manual fill use the same authorization gates. Local
              site blocks stay local and always win.
            </div>
          </Panel>
        </div>
        <Panel id="services" title="Supported services & origins">
          <p>
            Read-only information from the shipped service registry. A service
            needs validated sender evidence, an email template and exact
            approved HTTPS origins before support can be claimed.
          </p>
          {supportedServices.length === 0 ? (
            <div className="empty-state">
              <strong>No real services validated yet</strong>
              <p>
                No approved destination origins are currently shipped. Candidate
                services and synthetic demo fixtures are not supported real
                integrations.
              </p>
            </div>
          ) : (
            <ul className="report-list">
              {supportedServices.map((service) => (
                <li key={service.id}>
                  <h3>{service.name}</h3>
                  <ul>
                    {service.origins.map((origin) => (
                      <li key={origin}>
                        <code>{origin}</code>
                      </li>
                    ))}
                  </ul>
                  <p>Last validated: {service.validatedOn}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">
            This dashboard cannot edit trust rules, grant website access or
            override an unverified destination. UNKNOWN means insufficient
            evidence; it is not a phishing accusation.
          </p>
        </Panel>
        <footer>
          OTPGuard · Local protection
          <span>
            Canva pilot · additional services and public release remain gated.
          </span>
        </footer>
      </main>
    </Workspace>
  );
}
