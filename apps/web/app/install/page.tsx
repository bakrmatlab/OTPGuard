import React from 'react';
import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '../site';
export const metadata: Metadata = {
  title: 'Coming soon — OTPGuard for Chrome',
};
export default function InstallPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="guide">
          <div className="page-heading">
            <div>
              <p className="context">OTPGuard for Chrome</p>
              <h1>Coming soon.</h1>
              <p>We’re preparing OTPGuard for the Chrome Web Store.</p>
            </div>
          </div>
          <p>
            Public installation isn’t available yet. Try the demo to see how it
            works.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/#demo">
              Try the demo <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
