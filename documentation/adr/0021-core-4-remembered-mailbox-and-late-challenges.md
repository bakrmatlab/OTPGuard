# ADR0021 — Remember explicit Gmail connection and detect late SPA challenges

Date: October 4, 2026. Status: owner-selected Core 4 revision; local review.

## Problem and authorization

On the final Core 4 v1 artifact, the owner reported successful Canva login through
Find code / Retry, slow retrieval and disruptive repeated Connect actions. The owner
explicitly selected safe restoration after worker/browser restart, with fresh
account/mailbox checks and no automatic consent prompt. This supersedes ADR0017's
explicit-Connect-after-every-restart requirement for the controlled pilot; its
account separation, revocation disclosure and privacy requirements still apply.

A production-content Chromium regression reproduced no automatic detect message when
an SPA challenge appeared 90 seconds after page load. The scan timer had ended after
one minute. This is a concrete failure mechanism, not proof of the preceding live
attempt's exact timing. The existing manual scan remained usable.

## Decision

Explicit Connect records only version 1 and two SHA-256 digests in trusted-context
Chrome local storage: selected Clerk user/session binding, and that binding plus
lowercased Gmail mailbox. No plaintext user/session/mailbox, Gmail token, OTP, mail,
refresh credential or URL is stored. These nonsecret digests record connection intent,
not proof of current authority. They survive worker/browser restart locally, are
excluded from history/export/backend traffic, and are removed on explicit Disconnect
before provider cleanup. A detected account/session mismatch removes the old intent.
A new selected session requires explicit Connect. The record has no time-based
retention; it remains until removal/replacement or extension uninstall. Session expiry
still prevents restoration through the authoritative account check.

On popup connection check or eligible page request, a shared worker controller checks
fresh Clerk authority before any restoration. It compares the remembered owner binding,
then asks Chrome for an existing read-only token noninteractively and freshly checks
Gmail profile/scope. It verifies the mailbox digest and selected Clerk generation
before exposing CONNECTED. Concurrent checks share one operation. Missing intent,
corrupt/unavailable storage, missing grant, revocation, changed mailbox/account/session
or delayed invalidated result cannot restore. Only explicit Connect may open consent.
Disconnect cancels immediately and prevents pending Connect/restore from writing new
intent. No prior request, code or approval is restored; replay reservations are unchanged.
A connection made before this revision needs one explicit Connect to create intent.

The content adapter retains bounded detector traversal and one automatic attempt per
field identity. After the initial one-minute polling window, DOM mutation-triggered
scans continue for the live document, debounced to at most one scan per 500 ms; an
inactive page does not poll indefinitely. The observer disconnects on pagehide.
Every detection still enters the same origin/account/mailbox/permission/ambiguity
policy, and only a popup Fill click releases a code. New field detection does not
extend admitted request deadlines or mail freshness windows.

The connected current-check wrapper first applies a local generation/expiry guard,
checks browser/mailbox context, then performs one fresh authoritative account probe.
The previous extra remote read before the browser check is removed. No settled
provider response is cached. The synthetic full clicked-fill coordinator loop fell
from 11 to 7 remote account probes (2.75 s to 1.75 s under a 250 ms-per-probe model).
This is a modeled overhead reduction, not a measured live latency claim. Gmail mail
arrival, bounded retry schedule and DNS verification can still delay READY.

## Alternatives and consequences

Keeping reconnect-on-restart is safe but disrupted the owner's intended use. Persisting
Gmail tokens or plaintext identity was rejected. Treating a stored digest as authority,
using interactive OAuth on wake-up, accepting a changed mailbox, or restoring pending
approvals would violate the contract. Caching authoritative Clerk decisions across
checks was avoided; final checks remain fresh. Infinite fixed-interval DOM polling
was avoided in favor of throttled mutation-triggered scans.

The local digests are linkable within this browser profile; minimization is not
anonymity. Provider revocation remains project-wide and is not performed implicitly.
Restoration does not grant new access or establish public-provider/store approval.
DKIM signer/content, direct-receipt, unseen-copy replay and transaction-binding limits
in ADR0020 remain unchanged.

## Verification

The delayed SPA Chromium test failed on v1 and passed on the repaired v2 bundle.
Regression tests exercise restart restoration without interactive consent, concurrent
checks, wrong account/session/mailbox, signed-out/revoked authority, late logout,
corrupt/unreadable storage and explicit Disconnect removal. Existing session/focus/
replay/refusal tests remain required. Fresh live automatic detection, restoration and
latency still require owner-profile acceptance; see the Core 4 acceptance report.

## Delayed-mail follow-up

The owner reported the same live symptom on v3 and suggested that the automatic lookup
ran before the service sent the email. The retrieval engine already continued after an
initial empty result, but its last scheduled cycle was at 22 seconds. A deterministic
retrieval-engine regression reproduced returning no mail when the first email arrived
at 30 seconds. The schedule now checks at 0/2/6/12/22/32/42 seconds, with the existing
60-second request deadline, quota delays, context cancellation, message caps and policy
unchanged. Immediate available mail still returns on the first cycle; no initial delay
is imposed. There are at most seven cycles (previously five), ten bodies per cycle.
After no mail at the final cycle, the user may Retry; this is not infinite polling.
This repairs a demonstrated late-arrival case, without claiming that it was the sole
cause of the live missing automatic prompt. The pre-Retry status is being established
separately to distinguish no-mail from failed admission or cancellation.
