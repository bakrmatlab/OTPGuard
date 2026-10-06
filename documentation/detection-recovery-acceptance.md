# Detection and explicit email recovery acceptance

Second ranked reliability scope, continued at the owner's request. Parser changes
from scope 1 remain preserved in the local branch. No publication, merging,
deployment, provider requests or live mailbox/browser access occurred.

## Behavior

Unrelated navigation, sidebar and footer text no longer disqualifies the nearby
email challenge. If a region contains the field, its context remains relevant.
An uncertain single native OTP group offers “This is an email code” after Retry.
This explicit intent precedes retrieval and is separate from Fill. Positive
payment/authenticator context and bounded-context exhaustion still refuse.

The one-use intent expires at 30 seconds and is held only in worker memory.
Confirmation rechecks account session, mailbox, foreground document, permission
and local site settings, then asks that document to rescan the same empty fields.
Account/mailbox/settings changes, new admission, navigation, tab changes and
permission removal revoke intent. Replacement or user typing refuses it.

## Verification

Two production-content browser cases failed before implementation: unrelated
sidebar text blocked an email challenge; an uncertain field had no intent recovery.
Synthetic checks exercise those cases plus payment/authenticator refusal,
field replacement/typing, one-use/expiry/revocation, exact-popup routing and
keyboard confirmation while Fill remains disabled. Existing click-bound generic
retrieval and insertion cases remain part of regression validation.

Unit/integration checks: 561 tests; type checking, lint and formatting.
Browser acceptance: all 18 targeted production-content, popup and existing
core-flow cases passed (`bun run test:browser tests/browser/detection-recovery.spec.ts tests/browser/core3.spec.ts tests/browser/popup.spec.ts`).
Both provider-free and configured extension builds succeed. The configured local
review build uses existing public configuration and grants no permissions:
`/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.

This is synthetic regression evidence, not a measured 99% live success rate.
Shadow DOM, frames, non-native controls, languages and additional providers remain
outside this scope. Rank 3 challenge/resend tracking remains queued for review.
