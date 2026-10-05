import { auth } from '@clerk/nextjs/server';
import { webAccountConfigured } from '../../account-config';
import { Account } from '../account';
import { Dashboard } from '../dashboard';
export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const configured = webAccountConfigured();
  if (configured) await auth.protect({ unauthenticatedUrl: '/sign-in' });
  return <Dashboard account={configured ? <Account /> : undefined} />;
}
