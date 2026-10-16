# ADR 0001: The website and extension share one Clerk session

## Decision

Users sign in on otpguard.net with Clerk's standard components. The extension uses
Clerk's Chrome extension SDK with Sync Host `https://clerk.otpguard.net`, so it reads
the same session in this browser profile. Signing out in either place ends it for
both. The worker re-checks the session with Clerk before each operation and after
every await, and keeps no token cache.

The extension ID is fixed by the public key in `configuration/domain-auth.json`,
independent of Gmail.

## Why

A custom native Clerk client failed in Chromium because of an Origin and
Authorization header conflict. Clerk development keys put a browser token in request
URLs. One production session avoids both.

## Consequences

- Changing the website account changes the extension account and cancels its work.
- Sign-out targets the current session, not every device. Cookie events and fresh
  checks are prompt but not instantaneous remote revocation.
- A failed sign-out suspends the worker until a retry succeeds. The suspension is
  memory-only; a worker restart revalidates the session with Clerk.
- Gmail disconnect and history deletion stay separate actions.
