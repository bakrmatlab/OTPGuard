# Bounded timing/provider checks — October 5, 2026

Proposed title: `fix(extension): separate bounded search, confirmation and release`.
Owner requested rank 3 after committing/merging/pushing CI and challenge tracking.
This implementation is local for review on `codex/bounded-fill-timing`, based on
published main `26501e0`. Rank 3 publication is not authorized by this report.

## Result and acceptance

| Criterion                                       | Result                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slow delivery/authority leaves usable Fill time | Achieved synthetically: delivery at 52 seconds plus five-second current check offers 30 seconds, rather than three                                 |
| Late timely click can complete fresh checks     | Achieved: click at 29 seconds completes three two-second checks within a new 15-second release budget                                              |
| Every phase is bounded                          | Achieved: search/admission 60 seconds, confirmation 30 seconds, release 15 seconds; invalid phase timelines and late clicks refuse                 |
| Fresh authority before release                  | Retained: timely click records intent only; current account/mailbox/browser checks still precede prepare and recheck after prepare and reservation |
| Stalled or late results                         | Achieved: coordinator settles on phase expiry, ignores later success, and sends no subsequent release                                              |
| Candidate freshness and replay                  | Retained: a candidate aging past five minutes while waiting refuses; challenge window and reservations remain unchanged                            |
| Suspension/status expiry                        | Achieved synthetically: status read clears expired confirmation even before a delayed worker timer runs                                            |
| Live delivery/provider/server acceptance        | Unverified; no owner profile, mailbox, grant or installed build accessed                                                                           |

Changed components: coordinator phase/abort handling, worker timely-click/status
handling, and generic pure phase validation. `packages/security/timing.ts` centralizes
60/30/15 budgets. Reviewed automatic-policy timing remains 60 seconds.
[ADR0027](adr/0027-bounded-confirmation-and-release.md) records the architecture decision.
Privacy/reliability reports document the longer bounded volatile approval interval.

## Validation

Commands ran in the fresh provider-free export `/tmp/otpguard-timing-review`, with
Bun 1.4.2 and Node 22.19.0 on macOS arm64. Bun prefix:
`PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.

| Command                                                               | Outcome                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `bun install --frozen-lockfile`                                       | Passed                                                                                                 |
| `bun x --no-install vitest run tests/fill-timing.test.ts` on baseline | Three reproduced failures: 3-second confirmation, late-click cancellation and unsettled authority read |
| `bun run check` on final code/tests                                   | Passed: types/lint/format and 675 tests in 42 files                                                    |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                             | Passed, provider-free web and extension                                                                |
| `bun run build:mock`                                                  | Passed                                                                                                 |
| `bun run --filter @otpguard/extension build`                          | Passed on final production source                                                                      |
| `bun run test:browser`                                                | 71 passed, one skipped, zero failed                                                                    |
| `bun run package:review`                                              | Passed, fresh provider-free archives                                                                   |
| `bun run check:packages`                                              | Passed, extracted standalone routes/mobile/assets and MV3 worker/popup                                 |
| `git diff --check`                                                    | Passed                                                                                                 |

New timing tests use fake clocks and actual coordinator/policy seams. Existing
cancellation tests now wait for the real stalled operation rather than a fixed number
of microtasks; a late code-free prepare can finish after the newly bounded caller
returns cancelled, but no release follows. Intermediate strict typing failures were
fixed (phase timeout handle, confirmation expiry callback type, exact optional metadata).
The final full check passes without disabling tests or reducing release checks.

The pre-existing configured Gmail denial/reconnect/mailbox/revocation simulation is
skipped because this export lacks provider configuration. This is not a live acceptance
pass. No dependency, fixture permission, polling schedule, Gmail query cap, endpoint
or provider setup changed. Configured production timing and Linux execution of rank 3
remain unverified; preceding merged-scope CI is tracked separately below.

## Limits and manual reproduction

To reproduce synthetically, run the timing test file: hold retrieval for 52 seconds,
current checks for five, verify a full 30-second offer, then click after 20 seconds.
For the failure path, stall current/prepare/reservation and advance the appropriate
clock to its deadline; assert cancellation and zero later releases. Boundary tests
also reject expired/future/overlong phase times and candidates that age out.

For owner-assisted testing, request one new code on a supported HTTPS native input,
wait for the offer, click Fill before its displayed expiry, and confirm correct field
insertion separately from server login completion. No live trials were performed.
Provider latency beyond the 15-second release budget refuses deliberately. Underlying
Chrome/provider operations may continue after the coordinator detaches their results.
A value already released to a page cannot be retracted; uncertain acknowledgment keeps
its replay reservation. No automatic submission or OTP persistence is added.

The extension may retain approved candidate material in worker memory for up to
45 seconds after offer, with earlier search processing bounded by 60 seconds. Total
coordinator lifetime stays below 105 seconds from detection. Receipt heuristics,
late old-mail identity, same-mailbox concurrent ambiguity, worker restart/crash windows
and broader lifecycle/privacy acceptance remain limitations. A correct synthetic Fill
is not proof of a live success rate or server completion.

Stop for owner review. Retrieval/MIME coverage (rank 4) has not started.

## Owner publication authorization

After review, the owner explicitly requested committing, merging and pushing rank 3,
then starting rank 4 retrieval/MIME coverage in a new chat. This supersedes this
report's earlier local-only publication boundary for rank 3. Provider/live acceptance
limitations remain open; rank 4 has its own local implementation/review boundary.
