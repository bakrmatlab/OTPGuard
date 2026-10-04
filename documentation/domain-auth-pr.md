# Proposed PR

Title: `feat(auth): prepare domain-hosted Clerk sign-in and shared extension sessions`
Base: main. Branch: codex/domain-clerk-auth. Local review only.

## Summary

The custom native experiment failed real Chromium signup. Prepare otpguard.net website
sign-in/signup and the supported production Clerk extension Sync Host path with the
owner-approved shared session model.

```text
website signup/sign-in -> Clerk production session -> worker Sync Host
  -> reload session -> fresh convex token -> read-only validated subject
  -> recheck identity/generation -> fixed popup acceptance status
website or extension logout -> invalidate shared session and pending authority
```

Add an auth-only stable extension ID, authoritative session reload, failed-logout
suspension, read-only cloud identity probe and Vercel/Cloudflare/provider setup plan.
Retain the native failure evidence without porting its custom transport.

## Evidence

- **Before:** real native Chromium registration returns
  origin_authorization_headers_conflict; bootstrap/mocked success was insufficient.
  **After:** 301 synthetic unit/backend tests and 29 Chromium checks pass (one Gmail
  configuration skip), with production builds/types/lint/format passing. Loaded
  Chromium verifies the stable auth-only ID/permissions using synthetic public config.
- **Live result:** blocked/unverified. Exact Clerk app has no production instance and
  connected Vercel has no OTPGuard project. Domain DNS/certificates, Google social
  credentials, authenticated production Convex exchange and shared live logout require
  approved setup and actual Chromium acceptance. SDK source/builds do not prove login.
- [Commands and acceptance](domain-auth-acceptance.md), [deployment plan](domain-auth.md),
  [ADR0016](adr/0016-domain-hosted-shared-auth.md).

## Merge Danger

**Door:** two-way for this code/configuration; provider publication is a separate action.

**Blast Radius:** authentication.

Shared sign-out intentionally affects the selected website/extension session in this
browser profile. It does not revoke Gmail, delete local history or log out other devices.
No development issuer exception, real retrieval/fill, metadata sync or cloud history
is enabled. Git auto-deployment is disabled. No provider policy/DNS/deployment change,
remote publication, merge or store submission was performed.
