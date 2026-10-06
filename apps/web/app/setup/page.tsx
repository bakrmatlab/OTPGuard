import React from 'react';
import { SiteHeader, SiteFooter } from '../site';
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="guide">
          <div className="page-heading">
            <div>
              <p className="context">Chrome extension</p>
              <h1>Set up OTPGuard</h1>
              <p>Connect once. Choose Fill each time.</p>
            </div>
          </div>
          <div className="guide-end">
            <p>
              Your workspace checks each step and shows what to do next.
              Existing connections are kept.
            </p>
            <a className="button primary" href="/dashboard">
              Continue guided setup
            </a>
          </div>
          <ol className="setup-steps">
            <li>
              <div>
                <h2>Install the extension</h2>
                <p>
                  Load the current local review package in Chrome, then pin
                  OTPGuard to the toolbar.
                </p>
                <details>
                  <summary>Local installation steps</summary>
                  <p>
                    Open chrome://extensions, enable Developer mode, choose Load
                    unpacked, and select the provided extension folder. Public
                    store installation is not available yet.
                  </p>
                </details>
              </div>
              <span className="step-number" aria-hidden="true">
                1
              </span>
            </li>
            <li>
              <div>
                <h2>Sign in to OTPGuard</h2>
                <p>
                  Use your OTPGuard account. Your account signs you in; it does
                  not give access to Gmail.
                </p>
              </div>
              <span className="step-number" aria-hidden="true">
                2
              </span>
            </li>
            <li>
              <div>
                <h2>Connect Gmail</h2>
                <p>
                  Choose the mailbox that receives your codes. Google’s
                  read-only permission allows reading mail; OTPGuard processes
                  recent candidates inside the extension.
                </p>
              </div>
              <span className="step-number" aria-hidden="true">
                3
              </span>
            </li>
            <li>
              <div>
                <h2>Enable website access</h2>
                <p>
                  Optional HTTPS website access lets OTPGuard find code fields.
                  A recent code can still belong to a different sign-in: Fill
                  does not verify the sender or its relationship to the website.
                </p>
                <p>
                  Only choose Fill on a page you intended to use. The page can
                  read the inserted code and may continue automatically.
                </p>
              </div>
              <span className="step-number" aria-hidden="true">
                4
              </span>
            </li>
          </ol>
          <div className="guide-end">
            <p>
              Open the extension’s full-page settings: right-click its toolbar
              icon and choose Options. Gmail permission is requested only when
              you choose Connect Gmail.
            </p>
            <a className="button primary" href="/dashboard">
              Open your workspace <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
