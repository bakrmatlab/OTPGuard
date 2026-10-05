import React, { type ReactNode } from 'react';
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
  ['connections', 'Connected accounts'],
  ['activity', 'Activity'],
  ['devices', 'Devices'],
  ['settings', 'Settings'],
  ['services', 'Supported services'],
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
    <section id={id} className="panel" aria-labelledby={`${id}-title`}>
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
    <div className="dashboard-shell">
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
        <nav aria-label="Dashboard">
          {sections.map(([id, label], index) => (
            <a key={id} href={`#${id}`}>
              <span aria-hidden="true" className="nav-number">
                0{index + 1}
              </span>
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" aria-hidden="true" />
          Local-first by design<p>Mail and codes stay out of this dashboard.</p>
        </div>
      </aside>
      <main id="main" className="dashboard-main" tabIndex={-1}>
        <header className="topbar">
          <span>Workspace / Dashboard</span>
          <span className="badge">Local prototype</span>
        </header>
        <section
          id="overview"
          aria-labelledby="overview-title"
          className="overview"
        >
          <p className="eyebrow">ACCOUNT & SECURITY</p>
          <h1 id="overview-title">Your protection workspace</h1>
          <p className="intro">
            A clear view of what OTPGuard can report, and what stays in your
            browser.
          </p>
          <div className="capability-notice">
            <span className="notice-symbol" aria-hidden="true">
              i
            </span>
            <div>
              <strong>Connected features are not active</strong>
              <p>
                The owner-controlled Canva extension pilot supports user-clicked
                fill. Cloud metadata transport is unconfigured in this setup.
              </p>
            </div>
          </div>
          <div className="summary-grid">
            <div className="summary-card">
              <p>Account sync</p>
              <strong>Unconfigured</strong>
              <span>No cloud data read</span>
            </div>
            <div className="summary-card">
              <p>Supported services</p>
              <strong>{supportedServices.length} pilot service</strong>
              <span>Owner-controlled extension pilot</span>
            </div>
            <div className="summary-card">
              <p>Activity visibility</p>
              <strong>Browser-local</strong>
              <span>Unsynchronized history stays local</span>
            </div>
          </div>
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
                      The current development Clerk transport is unsupported
                      under the session privacy requirements.
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
            <p className="muted">
              Local history can span OTPGuard account changes. Retention is
              applied when the extension runs or history is accessed; inactive
              stored bytes may remain longer. A recorded fill means input
              insertion, not server login acceptance.
            </p>
            <button disabled aria-describedby="cloud-history-help">
              Enable cloud history
            </button>
            <p id="cloud-history-help" className="control-help">
              Unavailable until policy and authenticated transport requirements
              are resolved. No history is uploaded from this page.
            </p>
          </Panel>
          <Panel id="devices" title="Devices">
            <DeviceReports state={{ kind: 'unconfigured' }} />
            <p>
              When available, each report will show its receipt time and age.
              Reports at least five minutes old are stale; even a recent report
              cannot guarantee a currently valid Gmail token.
            </p>
            <p className="muted">
              Installation IDs identify extension installations, not hardware or
              security attestation. Remote device management is unavailable here
              and cannot instantly revoke an offline Google grant.
            </p>
          </Panel>
          <Panel id="settings" title="Settings">
            <div className="setting-row">
              <div>
                <h3>Automatic fill preference</h3>
                <p>
                  Manage the saved local preference in the extension. Its value
                  is unknown to this dashboard.
                </p>
              </div>
              <span className="badge">Local only</span>
            </div>
            <div className="setting-row">
              <div>
                <h3>Account settings sync</h3>
                <p>
                  Cloud settings sync is unconfigured. Local preferences remain
                  usable independently.
                </p>
              </div>
              <button disabled aria-describedby="settings-help">
                Enable sync
              </button>
            </div>
            <p id="settings-help" className="control-help">
              No settings are read or changed by this dashboard.
            </p>
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
          OTPGuard · Local prototype
          <span>
            Provider setup and real-flow acceptance remain incomplete.
          </span>
        </footer>
      </main>
    </div>
  );
}
