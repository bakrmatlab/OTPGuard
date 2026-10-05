import { webAccountConfigured } from '../../../account-config';
import { SignUp } from '@clerk/nextjs';
export default function SignUpPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/" aria-label="OTPGuard home">
        <span className="brand-mark" aria-hidden="true">
          O
        </span>
        OTPGuard
      </a>
      <h1>Create your OTPGuard account</h1>
      {webAccountConfigured() ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
        />
      ) : (
        <p>Account authentication is unconfigured.</p>
      )}
      <div className="auth-notice">
        <p>
          Use Google when offered by the configured provider, or complete the
          available account verification.
        </p>
        <p>
          The website and extension share this browser profile’s account
          session. Signing in does not connect Gmail.
        </p>
      </div>
      <a className="back-link" href="/">
        Back to home
      </a>
    </main>
  );
}
