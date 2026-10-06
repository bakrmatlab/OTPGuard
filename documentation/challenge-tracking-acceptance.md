# Challenge/resend tracking — October 5, 2026

Proposed title: `fix(extension): preserve challenge order across resend and Retry`.
Owner requested continuation after the separate CI repair. This is a local rank-2
scope on `codex/challenge-resend-tracking`, based on main `7266d66`, in
`/Users/bakrmatlab/.codex/worktrees/challenge-resend-tracking/OTPGuard`.
The original checkout and its uncommitted CI repair are preserved separately.
No commit, publication, merge, deployment, live mailbox/browser or provider action.

## Result and acceptance

| Acceptance                                | Result                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New site request versus Retry             | Achieved in synthetic tests: trusted request resets the receipt boundary; Retry retains it even after four minutes                                           |
| Resend with delayed clearing              | Achieved: records a challenge while fields contain user input, leaves that input intact, waits for empty supported fields and uses a new field binding       |
| Older admission/approval                  | Achieved: old provider completions cannot supersede a newer admitted gesture; browser-bound gestures cancel old approval before fresh authority reads finish |
| Reordered gesture/detection reads         | Achieved: fresh detection keeps the worker-observed gesture boundary when the gesture's authority read finishes later                                        |
| Old messages and replay                   | Achieved within receipt heuristics: pre-window mail is excluded; new challenges never clear reservations; repeated Fill of the same reserved message refuses |
| Concurrent login isolation                | Achieved conservatively: same-account/mailbox generic requests latch ambiguity after cancellation; different accounts/mailboxes remain independent           |
| Real ambiguity and explicit Fill          | Retained: two plausible new messages still refuse; no code leaves before explicit Fill; no newest-message tie breaker                                        |
| Server challenge identity/live acceptance | Unverified and inherently limited by current receipt/gesture hints; see limits below                                                                         |

Production changes are confined to `apps/extension/content.ts` and
`apps/extension/pipeline/coordinator.ts`. The protocol remains closed; new metadata
is volatile sequence/generation and existing browser bindings. Regression coverage
is in `tests/generic-fill.test.ts` and `tests/browser/core3.spec.ts`.
[ADR0026](adr/0026-volatile-challenge-ordering.md) records the decision and alternatives;
privacy and reliability status are updated in the same scope.

## Validation

Commands ran in `/tmp/otpguard-challenge-review` using Bun 1.4.2 and Node 22.19.0
on macOS arm64, with provider configuration absent. Bun command prefix:
`PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.

| Command                                                                                                                                   | Outcome                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun x --no-install vitest run tests/generic-fill.test.ts -t 'silently replaces\|before a new field scan\|older stalled'` on baseline     | Three reproduced failures: window rotated, old approval remained, stale admission filled |
| `OTPGuard_ARTIFACT=/tmp/otpguard-ci-repair/apps/extension/build/chrome-mv3-prod bun run test:browser --grep 'resend records a challenge'` | Baseline production content failed to emit a challenge while fields were nonempty        |
| `bun run check` on final implementation/tests                                                                                             | Passed: type/lint/format and 655 tests in 41 files                                       |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                                                                                                 | Passed: provider-free production extension/web                                           |
| `bun run build:mock`                                                                                                                      | Passed                                                                                   |
| `bun run test:browser --grep 'trusted .* starts a fresh\|resend records a challenge\|timestamps an email-request'`                        | Five passed                                                                              |
| `bun run test:browser`                                                                                                                    | 71 passed, one skipped, zero failed, including the new regression                        |
| `bun run package:review`                                                                                                                  | Passed: fresh provider-free review archives                                              |
| `bun run check:packages`                                                                                                                  | Passed: extracted standalone routes/mobile/assets and MV3 worker/popup                   |
| `git diff --check`                                                                                                                        | Passed in the final worktree                                                             |

The full browser validation export includes the two assertion-only CI fixes from
the prior scope. Those two files are not changed on the challenge-tracking branch.
Main alone retains the known stale alphanumeric insertion assertion until that
separate repair integrates; the combined validation does not hide a new failure.
The skipped configured Gmail denial/reconnect/mailbox/revocation simulation requires
configuration absent from this export. Linux CI and all owner-controlled live checks
remain unverified.

Initial dependency copying omitted the security workspace link; restoring that link
resolved type-check setup. A new replay test initially expected four sends; the
actual flow correctly has a fifth, code-free prepare before ledger refusal. Its
final assertions require exactly two releases and preserve both reservations.
No implementation gate was changed to satisfy that test.

## Reproduction and limits

In an isolated provider-free export, run the commands above. Synthetic browser steps:
start an empty email-code field, type a value, click Resend, confirm the value remains,
let the site clear it later, and verify fresh detection rejects an old field binding.
Coordinator tests separately hold authority/confirmation promises, deliver new gestures,
and assert no stale release. Live checks need an owner-generated request and explicit
Fill; no live check or installed-artifact replacement was performed here.

Receipt time and trusted gestures do not prove the server accepted a resend or that
mail belongs to that transaction. An old message delivered late inside the fresh
window remains plausible. Multiple plausible messages refuse; a single wrong candidate
can still be offered under the accepted generic contract. Same-mailbox concurrent
requests on different sites can refuse because site names do not establish ownership.
This scope does not claim perfect challenge identity or a representative live success
rate. Existing one-second receipt tolerance, freshness bounds, replay ledger, provider
checks and explicit Fill remain unchanged.

Tracking is memory-only, bounded, and loses its epochs on worker/content restart;
those lifecycle and crash-window improvements remain separate work. Unsupported frames,
shadow controls, languages and formats remain unsupported. No extension-driven form
submission or new persistent data/permission/provider request is added.

Stop for owner review. Timing/provider checks (rank 3) have not started.

## Owner publication authorization

The owner explicitly requested committing, merging and pushing this scope together
with the separate CI repair, then starting rank 3 timing/provider work. This
supersedes the earlier local-only publication boundary for these two scopes.
Live lifecycle/privacy and challenge-identity limitations remain unchanged.
