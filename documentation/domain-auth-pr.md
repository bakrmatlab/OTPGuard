# Proposed PR

Title: `feat(auth): prepare domain-hosted Clerk sign-in and shared extension sessions`
Base: main. Branch: codex/domain-clerk-auth. Owner authorized publication; live acceptance remains pending.

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
- **Production result:** https://otpguard.net is deployed with HTTPS; Clerk DNS/TLS
  verification is complete. Production Convex is deployed and rejects anonymous
  identity probes. Actual browser renders the Clerk sign-in form. Owner email verification, website-to-extension account sharing and production
  identity check passed. First logout revoked the website session but exposed worker
  navigation failure; callback retest also failed. Final selected Session.remove() implementation and
  revised regression pass, live retest pending. Reverse
  logout, revocation/switch/expiry and URL audit remain unverified.
  Google is disabled until production OAuth credentials are configured.
- [Commands and acceptance](domain-auth-acceptance.md), [deployment plan](domain-auth.md),
  [ADR0016](adr/0016-domain-hosted-shared-auth.md).

## Merge Danger

**Door:** two-way for this code/configuration; provider publication is a separate action.

**Blast Radius:** authentication.

Shared sign-out intentionally affects the selected website/extension session in this
browser profile. It does not revoke Gmail, delete local history or log out other devices.
No development issuer exception, real retrieval/fill, metadata sync or cloud history
is enabled. Git auto-deployment is disabled. Provider setup and production website/backend deployment were explicitly authorized
and completed. Merge and store submission have not been performed.
