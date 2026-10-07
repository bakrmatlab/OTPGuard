# First Fill failure diagnosis — October 7, 2026

Owner reports an empty Clerk code field after first Fill, then success after Retry.
Sanitized local history shows repeated CANCELLED/delivery and some ERROR/delivery
alongside successful fills. Do not commit that personal activity export.
Existing pipeline/focus tests pass; the live failure is not yet reproduced.

Reproduced a diagnostic defect: preparation refusal is flattened to delivery in
history, discarding the coordinator's existing closed cancellation reason. Preserve
that enum in new cancellation records, with readable Options labels. Old delivery
records remain readable but cannot reconstruct detail. No codes, mail, provider
errors, arbitrary strings, new permissions or telemetry are recorded. Delivery
without a known cancellation remains the legacy generic reason. The shared schema
recognizes new fixed enums; cloud activity remains disabled and the backend is not
deployed as part of this diagnostic change.

Regression failed with delivery before the change and passes with prepare-refused
afterward. Isolated `bun run check` passed all 818 tests, types, lint and formatting;
`bun run build` passed both builds. Configured extension rebuilt with existing public
configuration; owner build backed up in /tmp/otpguard-before-fill-diagnostics and
updated locally. Owner must Reload it and reload the Clerk page before a fresh attempt.

This improves diagnosis, not the underlying first-Fill behavior. Await the new
specific cancellation reason; do not relax field/session/focus/replay gates or
retry automatically. No commit, push or deployment performed.

Owner retest identified prepare-refused then release-refused on dashboard.clerk.com.
Neither enum identifies which content readiness/insertion check failed. Add closed
content refusal replies for current field, group/length binding and existing insertion
failure enums. Coordinator validates exact response shape and known labels before
recording; malformed/extra-field/arbitrary strings fall back to generic refusal.
No authority gate or success criteria changes. Plain true/false replies remain accepted.
819 tests and both builds pass. Configured local extension updated; require both
extension Reload and Clerk page reload to replace the old content script. Underlying
Clerk compatibility remains unverified pending that finer-grained failure.

Owner supplied field-not-ready and input-page-interference. A synthetic controlled
field reproduces a concrete compatibility defect: delayed plain, untrusted input
notifications with unchanged values falsely invalidate retained insertion. Upstream
input-otp emits such notifications after value/focus changes:
https://github.com/guilhermerodz/input-otp/blob/master/packages/input-otp/src/input.tsx
This is a plausible explanation of the Clerk report, not proof of its exact runtime.

Use one shared unchangedFrameworkInput predicate at pre-release edit invalidation
and retained insertion. Ignore only untrusted plain input events whose value equals
the previously observed/expected value. InputEvent edit intent, trusted events,
beforeinput/change, changed and changed-then-restored values still refuse. No automatic
retry, rebind, rollback, timing relaxation or code release outside explicit Fill.
The native field, constraints, visibility and document checks still apply.

The unchanged-event regression failed with page-interference before the repair and
passes afterward. Six retained-insertion cases cover benign notification, value
change, restored value, beforeinput, InputEvent and trusted input. Existing input
compatibility browser regressions remain available, but browser execution is not
performed under no computer use. Both builds and isolated checks pass. Configured
owner build updated locally; Reload extension and reload Clerk page for live retest.

Owner live acceptance: after reloading the updated extension, the owner confirmed
that Fill worked on dashboard.clerk.com. This confirms the reported scenario;
it does not assert compatibility with every website. Final validation passed:
825 unit tests, type checking, lint, formatting, and both production builds.
The owner authorized commit, push, and deployment on October 7, 2026.
