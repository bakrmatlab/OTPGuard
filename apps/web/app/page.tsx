import { webAccountConfigured } from '../account-config';
import { Account } from './account';
import { Dashboard } from './dashboard';
export default function Home() {
  return (
    <Dashboard account={webAccountConfigured() ? <Account /> : undefined} />
  );
}
