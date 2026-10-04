# ADR0015: Isolate the independent native authentication experiment

Date: October 4, 2026. Status: owner-approved session model; implementation for review.

## Problem

The owner has no domain and approved independent extension/dashboard Clerk sessions.
The installed development extension SDK places a browser JWT in request URLs, which
violates OTPGuard's credential transport contract. Cloud setup alone does not fix it.

## Decision

Build a separate unpacked development auth extension using Clerk's documented native
FAPI primitives, memory-only header credentials and authoritative session refresh.
Bind its Convex development issuer opt-in to the exact existing development deployment.
Keep ordinary production/web gates and real Gmail authorization closed.

## Alternatives

The standard development SDK and proxy preserve the URL credential problem. Buying a
domain was not authorized. Expo internals are platform-specific; privileged backend
session creation would bypass owner sign-in. Copying a browser JWT would not establish
an independent native client. None is used.

## Consequences and evidence

Dashboard logout does not end the native extension session. Worker restart requires
new login; session expiry, selected-session change, revocation and extension logout
invalidate local authority. Broader auth factors and production rollout are deferred.
The existing trusted SMTP receipt requirement remains unchanged.

Exact-instance readback reports native API enabled. Real Node/Chromium native bootstrap,
synthetic login/Convex/logout and anonymous live Convex rejection passed. Owner live
login/token/logout is unverified. See [scope and acceptance](../native-auth-prototype.md).

## Browser feasibility correction

Owner review reproduced HTTP 400 `origin_authorization_headers_conflict` in the
actual Chromium worker. Node registration reaches email verification, while the
browser automatically supplies Origin alongside the native Authorization header.
Clerk documents these headers as mutually exclusive. Bootstrap and synthetic
transport checks were insufficient evidence for browser login feasibility.

The experiment remains blocked, with a specific safe UI error and regression test.
No header stripping, new permissions or proxy is approved by this decision.
Replacement transport requires design review and actual browser signup acceptance.
