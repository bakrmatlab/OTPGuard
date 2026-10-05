export default function Home() {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="auth-brand" href="/" aria-label="OTPGuard home">
          <span className="brand-mark" aria-hidden="true">
            O
          </span>
          OTPGuard
        </a>
        <nav aria-label="Main">
          <a href="#features">Features</a>
          <a href="/sign-in">Sign in</a>
          <a className="primary-link" href="/sign-up">
            Create account
          </a>
        </nav>
      </header>
      <main id="main" className="landing-main">
        <section className="landing-hero">
          <p className="eyebrow">Your inbox. Your control.</p>
          <h1>Email codes, with less friction.</h1>
          <p className="landing-lead">
            OTPGuard helps you find and fill email verification codes on
            supported sites. Codes are checked locally, and you decide when to
            fill.
          </p>
          <div className="landing-actions">
            <a className="primary-link" href="/sign-up">
              Get started
            </a>
            <a href="#features">Explore features →</a>
          </div>
          <p className="muted">
            Currently available as a Canva pilot. More sites are planned.
          </p>
        </section>
        <section
          id="features"
          className="landing-features"
          aria-labelledby="features-title"
        >
          <h2 id="features-title">A simpler verification flow</h2>
          <div className="landing-grid">
            <article>
              <span className="eyebrow">01 · Find</span>
              <h3>Find the right code</h3>
              <p>
                Connect Gmail in the extension, then find a matching email code
                for a supported challenge.
              </p>
            </article>
            <article>
              <span className="eyebrow">02 · Review</span>
              <h3>Stay in control</h3>
              <p>
                Review the result and choose Fill. OTPGuard never clicks submit;
                the site may react to input events.
              </p>
            </article>
            <article>
              <span className="eyebrow">03 · Manage</span>
              <h3>Keep things organized</h3>
              <p>
                Use your dashboard for account controls, setup guidance and
                supported sites. Manage local history and preferences in the
                extension.
              </p>
            </article>
          </div>
        </section>
        <section className="landing-privacy">
          <div>
            <p className="eyebrow">Built around clear boundaries</p>
            <h2>Your codes stay local.</h2>
            <p>
              Account sign-in is separate from Gmail access. Mailbox and site
              permissions are granted in the extension. Cloud history and
              settings sync are currently unavailable.
            </p>
          </div>
          <a className="primary-link" href="/sign-up">
            Create your account
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <span>OTPGuard · Local-first email verification</span>
        <a href="/dashboard">Open dashboard</a>
      </footer>
    </div>
  );
}
