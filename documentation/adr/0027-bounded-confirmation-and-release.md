# ADR0027 — Separate bounded confirmation and release budgets

Status: local implementation for owner review, October 5, 2026.

## Problem and evidence

Search, fresh authority checks and Fill shared one 60-second request deadline.
Synthetic delivery at 52 seconds plus a five-second authority read left only three
seconds for Fill. A click at 29 seconds could expire during fresh release checks.
A stalled authority promise left the handler unresolved after cancellation.
`tests/fill-timing.test.ts` reproduced all three before implementation.

## Decision

In generic user-confirmed mode, admission/search remains bounded by 60 seconds from
the worker's observed detection. Offer a full 30-second confirmation phase only if
selection and fresh current checks finish before that search deadline. A timely
explicit Fill click creates a separate release budget of at most 15 seconds.
Total coordinator lifetime is therefore less than 105 seconds from detection.
No candidate is offered after search expiry; no late click renews approval.

The worker records a current, unexpired popup click synchronously after local settings/
block checks. It does not wait for a duplicate page query before recording the click.
The coordinator still rechecks fresh account, mailbox and browser authority before
prepare, after prepare and after replay reservation. Those checks cannot be replaced
by a cached pre-click authorization. The content binding expires at the release
budget and still rechecks the actual fields. Explicit Fill and no extension submission
remain mandatory.

Pure generic assessment validates worker-observed offered/clicked phase timestamps
and each phase cap. The reviewed automatic policy retains its 60-second deadline.
Receipt-window, five-minute candidate freshness, ambiguity and replay gates do not
change; freshness is reassessed after waiting. Confirmation/release deadline changes
do not change the original challenge receipt boundary or reset replay reservations.

Awaited retrieval, confirmation, authority, prepare, reservation and release results
are detached on request abort. A late result cannot advance another stage or authorize
a release. Status reads enforce confirmation expiry even if worker timers are delayed.

## Alternatives and consequences

A longer undifferentiated timeout could make slow delivery consume all click time
again. Skipping fresh authority checks would weaken release safety. Extending expired
confirmations, resetting the challenge window or discarding reservations would hide
real uncertainty. None is adopted.

The approved candidate may remain in volatile memory for up to 45 seconds after being
offered (30 to click plus 15 to release), with bounded search processing before that.
No code, mail, token or new timing metadata is persisted, logged or uploaded. Timers
remain best effort; worker termination discards pending approval. Very slow authority
beyond 15 seconds refuses. An underlying browser/provider promise may continue after
the coordinator detaches; its late result does not resume the request. A release
already sent to a page cannot be retracted; an uncertain/late acknowledgment retains
the write-ahead reservation rather than enabling replay.

No permission, provider grant, query cap, polling schedule, network endpoint, cloud
transport, format or compatibility scope changes. Live delivery/provider latency and
server completion remain unverified. See [acceptance](../timing-provider-acceptance.md).
