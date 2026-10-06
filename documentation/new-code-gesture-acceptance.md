# New-code gesture coverage

The owner reported two plausible recent emails on the code page. That diagnostic
is a genuine selection refusal, not parser wording or replay failure. Inspection
found that the visible “Request a new code” action was not recognized by the
existing trusted resend observer. The synthetic production-content regression
reproduced the missing cancellation/fresh detect event. This is a proven generic
gesture coverage bug; the screenshot alone does not prove the owner clicked it.

The same handler now recognizes request/get/send/email a new/another code wording,
including optional verification wording, alongside resend/send-again. It still
requires a trusted user click in the bounded nearby active email-code challenge.
Script clicks do not establish freshness. A recognized action cancels existing
approval and emits fresh detection for the same fields. The existing coordinator
starts a fresh browser/worker-observed receipt window rather than the prior lookback.
Neither wording nor timing authorizes release or proves server challenge identity.

Production-content browser tests cover Resend code, Request a new code and Send
another code, with script-click refusal, old approval cancellation, fresh flag and
later field replacement. Existing composed tests prove resend excludes previous mail
and retry preserves the existing window. A new test verifies two newly plausible
emails in a fresh window still refuse without release. No newest-email tie breaker,
site-specific selector/mapping, broad history removal or automatic site click is added.

The popup now tells users with competing messages to request one new code on the
site, wait for its email and retry. Requesting multiple codes inside a close time
window or late delivery can remain ambiguous; that refusal is intentional.

`bun run check` passes types, lint, formatting and 646 tests. Provider-free and
configured extension builds succeed; `git diff --check` passes. The final targeted
browser run passes all 35 tests. Validation uses pinned Bun 1.4.2 and locked dependencies
in an isolated source export; live owner acceptance remains unverified. No live
mail/browser/provider access, grants, publication, merging or deployment occurred.

Configured review build:
`/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.
After loading it, refresh the page, use its Request a new code action once, wait
for the fresh email and use Fill when offered. Popup Retry alone deliberately
preserves the current challenge window.
