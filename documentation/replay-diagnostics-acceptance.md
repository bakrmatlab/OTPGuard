# Replay-refusal diagnostics

The owner reported UNKNOWN after code selection, Fill confirmation and preparation,
with the last stage “Checking that this email has not already been used”. Inspection
found that reused-email reservations, corrupt/full storage and read/write failures
all returned false and produced the same message-binding UNKNOWN. The screenshot
cannot distinguish those causes. Whether this was a fresh resend is pending owner
input; no underlying fresh-code failure is claimed fixed.

The ledger now exposes a closed diagnostic result: reserved, already-used or
unavailable. Its boolean API remains compatible. The same hashed account/mailbox/
message keys, serialized write-ahead operation, capacity, ten-minute retention and
no-rollback behavior remain unchanged. Fresh message IDs can reserve independently.
No history is cleared, no consumed email is made eligible and no release gate is
weakened. No new stored data or secret logging is added.

The coordinator remains UNKNOWN/message-binding on refusal, with an optional local
replay enum. The popup uses that enum for specific recovery copy: “Request a fresh
code” or “Local protection unavailable”. Earlier reservation does not prove login
success; storage failure does not prove reuse. Legacy boolean failures remain the
existing generic refusal rather than inventing a diagnosis.

Synthetic regressions cover a used email, a fresh message, corrupt storage and failed
writes, coordinator no-release for each detailed refusal, and both popup messages.
`bun run check` passes types, lint, formatting and 645 tests.
`bun run test:browser tests/browser/popup.spec.ts` passes all four popup tests.
Provider-free and configured builds pass; `git diff --check` passes. The initial
regression failed because a detailed reservation result was unavailable.

Configured review build:
`/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.
No live browser/mailbox/provider access, record clearing, grants, publication,
merging or deployment occurred. Exact owner-report diagnosis and live acceptance
remain unverified; fresh-versus-retry information is required for the next step.
