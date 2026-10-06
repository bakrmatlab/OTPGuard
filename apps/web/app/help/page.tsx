import React from 'react';
import { SiteHeader, SiteFooter } from '../site';
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="guide help">
          <div className="page-heading">
            <div>
              <h1>Help & privacy</h1>
              <p>The useful details, in one place.</p>
            </div>
          </div>
          <details open>
            <summary>What happens when I choose Fill?</summary>
            <p>
              The extension checks that your account, mailbox, current page and
              code field still match the pending request. It inserts the code
              only after your click. It never clicks Submit or submits a form;
              some websites continue automatically when the field is filled.
            </p>
          </details>
          <details>
            <summary>Does “Code found” mean the site is verified?</summary>
            <p>
              No. A recent, unambiguous email code is a candidate. Timing and
              format do not prove sender identity or that the email belongs to
              this website’s sign-in. A wrong single candidate is possible.
            </p>
          </details>
          <details>
            <summary>Where does my mail go?</summary>
            <p>
              Gmail tokens, messages and codes stay inside the extension. They
              are not sent to OTPGuard servers or saved in application history.
              Once inserted, a code is readable by the website.
            </p>
          </details>
          <details>
            <summary>Why won’t OTPGuard fill?</summary>
            <p>
              It stops for ambiguous codes, unsupported fields, expired offers,
              changed pages, typed-in values, missing permissions, disconnected
              accounts or blocked sites. Request a new code or complete your
              usual manual sign-in.
            </p>
          </details>
          <details>
            <summary>Can this website change extension settings?</summary>
            <p>
              Yes. Sign in, open the dashboard and choose Connect this browser.
              You can manage Gmail, automatic finding, blocked sites and local
              history through your installed extension. Data stays in this
              Chrome profile; cloud synchronization remains off.
            </p>
          </details>
          <details>
            <summary>How do I disconnect Gmail?</summary>
            <p>
              Choose Disconnect Gmail in the dashboard’s Browser settings or in
              the extension’s Options screen. Disconnect cancels pending
              requests, clears local connection state and attempts to revoke the
              provider grant. Signing out of OTPGuard is a separate action.
            </p>
          </details>
          <a className="button secondary" href="/setup">
            Setup guide
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
