import { webAccountConfigured } from '../account-config';
import { Account } from './account';
export default function Home() {
  return (
    <main>
      <h1>OTPGuard</h1>
      {webAccountConfigured() ? (
        <Account />
      ) : (
        <p>Account authentication is unconfigured.</p>
      )}
      <p>
        OTPGuard account sign-in is separate from Gmail consent and mailbox
        identity.
      </p>
      <p role="status">Gmail connection and autofill are not yet supported.</p>
    </main>
  );
}
