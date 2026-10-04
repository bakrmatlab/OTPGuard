import { webAccountConfigured } from '../../../account-config';
import { SignUp } from '@clerk/nextjs';
export default function SignUpPage() {
  return (
    <main>
      <h1>Create your OTPGuard account</h1>
      {webAccountConfigured() ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/"
        />
      ) : (
        <p>Account authentication is unconfigured.</p>
      )}
      <p>
        Use Google when offered by the configured provider, or complete the
        available account verification.
      </p>
      <p>
        The website and extension share this browser profile’s account session.
        Signing in does not connect Gmail.
      </p>
    </main>
  );
}
