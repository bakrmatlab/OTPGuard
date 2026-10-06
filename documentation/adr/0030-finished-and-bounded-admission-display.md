# ADR0030 — Finish and bound the admission display

Status: local owner-reported popup repair, October 6, 2026.

## Problem and evidence

The owner reported the configured popup remaining “Looking for your code” at 117
seconds with a page-check stage at 116 seconds. No mail/code/token or screenshot is
retained in this report. This exceeds the existing 60-second search/admission budget.

Three synthetic regressions reproduced incomplete refusal reporting, inconsistent
foreground snapshots and status reads that ignored overdue admission when its timer
had not run. The initial browser foreground probe could return false, then the final
`current` probe return true, leaving a returned context with `foreground: false`.
The coordinator refused that context without finishing the worker's admitting display.
A completed refusal could therefore look like an indefinitely pending search.

A page progress label also remained visible while the connected wrapper performed
its final fresh account read. The screenshot identifies a stuck display but cannot
prove which provider/browser operation or race occurred in the live request.

## Decision

Use `current(context)` as the single final browser foreground check before returning
an admission context. The provisional context has `foreground: true`, but is returned
only after the existing frame/document/exact URL/origin/permission/settings/foreground
checks succeed. No earlier result substitutes for this final check. An unfocused or
changed browser still refuses; a later fresh retry must pass its own checks.

Explicitly finish foreground/email-flow admission refusals with the existing page
failure callback. The popup then reports page unavailable instead of searching.

Track a volatile worker admission display deadline using the existing SEARCH_MS.
A popup status read past that deadline asks the coordinator to enforce its pending
admission deadlines, cancels their signals, and displays CANCELLED/deadline immediately.
Timers remain normal operation; status reads also enforce bounds after suspension.
Late successful context results cannot resume retrieval or release. Expiration does
not clear challenge windows, message reservations or remembered connection state.

Update progress before later authoritative account/mailbox reads and live browser
checks. This labels the current boundary more accurately; concurrent operations can
still interleave the volatile stage trail. Diagnostics have no authorization role.

## Alternatives and consequences

Extending expiry, caching authority or trusting the initial foreground snapshot could
hide real invalidation; none is adopted. Cancelling the entire coordinator via its
reset path would clear challenge windows, so status expiry targets overdue admissions
instead. Removing confirmation or replay protection does not address the display bug.

These repairs prevent reproduced indefinite-search displays and the inconsistent
foreground context. They do not prove the precise cause of the owner's live stall,
provider availability, representative login success or server transaction identity.
Underlying stalled browser/provider calls can still finish after detachment. A timeout
refuses and requires a fresh supported attempt rather than releasing uncertain mail.

No permissions, provider setup, backend traffic, persistence, logging, mail/code formats,
60/30/15 budgets, complete retrieval caps or release authority are broadened. Generic
matches remain CANDIDATE with required extension-owned Fill, exact browser/field binding,
fresh account/mailbox authority and write-ahead replay refusal. No extension submission.

## Verification

See [popup admission acceptance](../popup-admission-repair-acceptance.md). Tests use
actual coordinator/worker/connected seams with synthetic Chrome/provider operations,
fake suspension clocks and late completion. Full checks and artifacts are separate
from owner-profile/live acceptance; existing configured builds are preserved.
