import React, { type ReactNode } from 'react';
import { Workspace, WorkspaceNavigation } from './workspace';
import { SiteHeader, SiteFooter } from './site';
import {
  BrowserManagement,
  BrowserConnection,
  BrowserMailbox,
  BrowserPreferences,
  BrowserActivity,
} from './browser-management';
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

const sections = [
  ['connections', 'Browser settings'],
  ['activity', 'Activity'],
  ['settings', 'Preferences'],
] as const;
export function Dashboard({
  account,
  configured = false,
}: {
  account?: ReactNode;
  configured?: boolean;
}) {
  return (
    <>
      <SiteHeader />
      <BrowserManagement configured={configured}>
        <Workspace>
          <aside className="workspace-nav">
            <p className="workspace-name">Your workspace</p>
            <WorkspaceNavigation sections={sections} />
            <nav aria-label="Guides">
              <a href="/setup">Setup</a>
              <a href="/help">Help &amp; privacy</a>
            </nav>
          </aside>
          <main id="main" className="workspace-content" tabIndex={-1}>
            <section id="connections" className="workspace-panel" tabIndex={-1}>
              <div className="page-heading">
                <div>
                  <p className="context">This Chrome profile</p>
                  <h1>Browser settings</h1>
                  <p>Manage your account and this browser from one place.</p>
                </div>
              </div>
              <BrowserConnection />
              <section className="settings-section">
                <div className="settings-heading">
                  <h2>OTPGuard account</h2>
                  <p>Account sign-in is separate from Gmail access.</p>
                </div>
                {account ?? <p>Account authentication is unconfigured.</p>}
              </section>
              <section className="settings-section">
                <div className="settings-heading">
                  <h2>Gmail mailbox</h2>
                  <p>Your Gmail connection stays inside the extension.</p>
                </div>
                <BrowserMailbox />
              </section>
              <a className="text-link" href="/setup">
                Setup guide <span aria-hidden="true">↗</span>
              </a>
            </section>
            <section id="settings" className="workspace-panel" tabIndex={-1}>
              <div className="page-heading">
                <div>
                  <h1>Preferences</h1>
                  <p>Local controls for this browser.</p>
                </div>
              </div>
              <BrowserPreferences />
            </section>
            <section id="activity" className="workspace-panel" tabIndex={-1}>
              <div className="page-heading">
                <div>
                  <h1>Activity</h1>
                  <p>Results stay in your browser.</p>
                </div>
              </div>
              <BrowserActivity />
            </section>
          </main>
        </Workspace>
      </BrowserManagement>
      <SiteFooter />
    </>
  );
}
