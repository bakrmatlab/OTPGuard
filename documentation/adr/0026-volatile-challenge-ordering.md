# ADR0026 — Volatile challenge ordering and field binding

Status: implemented locally for owner review, October 5, 2026.

## Problem

Generic request gestures, field detection and provider authority checks can complete
in different orders. A resend while fields contain a value previously produced no
fresh detection, and a delayed old admission could supersede a newer challenge.
Retry also silently replaced its original receipt window after four minutes.

## Decision

Keep challenge tracking entirely in content-script/worker memory. A trusted nearby
resend records a closed challenge event immediately, invalidates the old content
binding and advances its group identifier generation. Its fresh detection remains
pending while fields are nonempty. The extension never clears user values itself.
Early email-request gestures use the same invalidation rule.

The worker records gesture arrival before provider awaits using browser-provided
parent tab/document metadata. That metadata permits cancellation only; account,
mailbox, document, URL, foreground, settings and explicit Fill checks still gate
retrieval and release. An admission sequence prevents old asynchronous completions
from superseding newer ones. Receipt hints bind to the validated exact browser URL;
navigation removes the pending browser hint. Existing bounded tracking limits remain.

Retry and control replacement preserve the original receipt boundary for that exact
account/mailbox/tab/document/URL. Elapsed time alone does not create a new challenge.
A fresh locally observed site request is required to reset it. Existing message
reservation/replay protection is independent and is never cleared by a new challenge.

Concurrent requests sharing the same account/mailbox/generic service continue to
latch ambiguity, even if one subsequently cancels. Different accounts/mailboxes
remain independent. Destination wording does not establish server transaction identity.

## Alternatives and consequences

Selecting the latest code, forgetting older reservations or treating Retry as resend
would hide real ambiguity. Persisting challenge state would introduce lifecycle,
privacy and migration work outside this local scope. Page-supplied timestamps or
transaction claims would cross the authority boundary. None is adopted.

These are heuristic gesture/receipt boundaries, not proof that the site accepted a
request or that a message belongs to its server transaction. A delayed old message
received inside a new window can still compete, and a single wrong message remains
possible. Same-mailbox concurrent logins can deliberately refuse. Worker/content
restart handling and broader compatibility remain separate backlog scopes.

## Evidence

Three coordinator regressions and a production-content browser regression reproduced
window rotation, delayed admission, pending approval and nonempty-field resend gaps.
Additional tests cover reversed gesture/detection authority completion, immediate
cancellation during stalled authority, replay reservations and concurrent isolation.
See [acceptance](../challenge-tracking-acceptance.md) for commands and limitations.
