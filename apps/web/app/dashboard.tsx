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
