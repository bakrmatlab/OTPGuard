'use client';
import { useUser, UserButton } from '@clerk/nextjs';
export function Account() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <p>Checking account session…</p>;
  return user ? (
    <section>
      <h2>OTPGuard account</h2>
      <p>{user.primaryEmailAddress?.emailAddress ?? user.id}</p>
      <p>Account ID: {user.id}</p>
      <p>
        Sign-out also signs out the OTPGuard extension in this browser profile.
      </p>
      <UserButton />
    </section>
  ) : (
    <a href="/sign-in">Sign in to OTPGuard</a>
  );
}
