# Detection-time popup opening

Owner requested the extension popup as soon as an OTP screen appears. Automatic
supported email-code detection now starts a presentation-only popup attempt in
parallel with account/mailbox admission. It no longer waits for a code candidate.
No arbitrary TOTP/payment/uncertain-field automatic detection was enabled.

The worker validates the extension sender, top-level active document, HTTPS origin,
current browser URL/document, foreground tab/window, permission, available settings,
automatic-finding preference and local block before opening. The request's abort
signal and preferences are checked again before opening. Early attempts deduplicate
by tab/document/live URL/field group; navigation/display invalidation clears that
volatile metadata. Browser-derived windowId targets the right window.

The callback is presentation only. Provider checks, retrieval limits, account/mailbox
binding and required Fill remain unchanged. Rejected opening does not break admission,
release a code or retry insertion. Manual Retry does not trigger early automatic
presentation. Existing code-ready prompting/fallback remains available. If Chrome
refuses automatic opening, use the extension icon; no alternate browser window or
notification permission was added.

The initial production-worker seam regression failed because no detection-time
callback existed. Additional coordinator tests hold admission unresolved, prove early
presentation starts without any prepare/release message, and refuse Fill even when
opening failed. Worker tests cover duplicate concurrent detection, disabled prompting,
blocks, permission refusal, background tabs, wrong sender/document and aborted work.

Validation: pinned Bun 1.4.2 with locked dependencies in the isolated source export;
`bun run check` passes types, lint, formatting and 642 tests.
`bun run test:browser tests/browser/detection-recovery.spec.ts tests/browser/core3.spec.ts tests/browser/popup.spec.ts` passes all 33 targeted browser tests.
Provider-free and configured builds succeed. `git diff --check` passes. No live
browser/mailbox/provider access, grant changes, publication, merging or deployment.
Automatic opening on the owner's installed Chrome remains a live acceptance check.

Configured review build:
`/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.
