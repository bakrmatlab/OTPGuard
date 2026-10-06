'use client';
import { useUser, UserButton } from '@clerk/nextjs';
export function Account() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <p role="status">Checking account session…</p>;
  return user ? (
    <div className="account-session">
      <p>{user.primaryEmailAddress?.emailAddress ?? 'Signed in'}</p>
      <p>
        Sign-out also signs out the OTPGuard extension in this browser profile.
      </p>
      <div className="profile-control">
        <span>Manage your profile</span>
        <UserButton />
      </div>
    </div>
  ) : (
    <a className="account-link" href="/sign-in">
      Sign in to OTPGuard
    </a>
  );
}
