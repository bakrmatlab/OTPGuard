import { webAccountConfigured } from '../../../account-config';
import { SignIn } from '@clerk/nextjs';
export default function SignInPage() {
  return (
    <main>
      <h1>OTPGuard account sign-in</h1>
      {webAccountConfigured() ? (
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      ) : (
        <p>Account authentication is unconfigured.</p>
      )}
      <p>
        Signing in also signs in the OTPGuard extension in this browser profile.
        Signing out ends this shared session.
      </p>
      <p>Signing in does not connect Gmail.</p>
    </main>
  );
}
