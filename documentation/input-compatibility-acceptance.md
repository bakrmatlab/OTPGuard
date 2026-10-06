# Reliability rank 6 — input compatibility

October 6, 2026. Proposed title: `fix(extension): invalidate edited bindings and observe retained input`.
Local branch `codex/input-compatibility`, based on published main
`a103a6d52092fce607afeeeac1d28a1822d81809`. Historical reliability row 7, not historical PR6.
Local review only; no commit, merge, push, deployment, grant change or next rank.

## Result and acceptance

| Criterion                         | Result                                                                                                                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native framework state            | Achieved synthetically: React single/split values and state retain leading zeros through the observation window                                                                                                                                             |
| Split/replaced controls           | Achieved synthetically: existing stale/replaced/disabled/hidden and split interference regressions refuse without overwriting later values                                                                                                                  |
| Delayed clearing                  | Achieved within a nominal 500 ms window: 200 ms clearing refuses; later clearing remains possible                                                                                                                                                           |
| User typing                       | Achieved: searching/prepared production-content bindings refuse after typing and immediate clearing; retained input events invalidate acknowledgment                                                                                                        |
| Constraints                       | Achieved: pattern changes are rechecked during retention; existing format/type/length refusals remain                                                                                                                                                       |
| Site-driven completion/submission | Partial: a synthetic site's completion transition removes controls and returns uncertain insertion; submit APIs/button clicks are guarded in insertion tests. No actual form/network submission was initiated; live site auto-submission remains unverified |
| Confirmation and authority        | Achieved synthetically: existing required Fill, account/mailbox/document/origin/field/foreground, expiry, ambiguity and replay regressions retained                                                                                                         |
| Live sites / server acceptance    | Unverified; no live mail, owner browser profile or provider access                                                                                                                                                                                          |

[ADR0032](adr/0032-bounded-input-retention.md) records the decision and limits.
Changed code: content edit invalidation, insertion retention observation, and timestamp-based
coordinator phase deadline calculation. Tests add six insertion cases, two production
content cases and one deterministic phase-clock regression. No detector or code format
expansion, permission/provider/storage/backend change. Synthetic values stay in fixtures.

## Validation

Commands run in `/tmp/otpguard-input-review`, a tracked-source export with the preserved
provider-free prior web build and pinned prior dependency directories. Runtime Bun 1.4.2,
Node 22.19.0, macOS arm64. Prefix `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.
Browser traces/screenshots/video are off; Chromium uses isolated synthetic fixtures.
The agent-browser CLI is unavailable; repository Playwright supplies actual DOM/artifact checks.

- Baseline `bun x --no-install playwright test tests/browser/insertion.spec.ts -g 'retention refuses'`: three intended failures, false filled for late clearing, changed pattern and transient edit.
- Baseline `bun x --no-install vitest run tests/fill-timing.test.ts -t 'clock advances'`: intended UNKNOWN/request failure with a clock advancing between reads.
- Fixed `bun x --no-install vitest run tests/fill-timing.test.ts`: 19 passed.
- Targeted final `bun x --no-install playwright test tests/browser/core3.spec.ts tests/browser/insertion.spec.ts`: 40 passed before the phase-clock correction; both production edit phases and all insertion cases passed.
- `bun run check`: passed types/lint/format and 789 unit tests in 44 files.
- `bun run --filter @otpguard/extension build`: passed provider-free artifact.
- `bun run build:mock`: passed isolated development artifact.
- `bun run test:browser`: 87 passed, one configured-provider simulation skipped because this export has no provider configuration; zero failed. That case was not separately executed for rank 6.
- `bun run package:review` and `bun run check:packages`: passed provider-free review ZIP/provenance and extracted standalone web/MV3 worker/popup checks.

The first full browser run had 85 passed, one skipped and one failed composed nested
fixture (UNKNOWN/request). Investigation reproduced a real coordinator clock-read race:
deadlines could exceed the recorded phase bound by a millisecond. The deterministic
regression now passes using recorded offer/click times, with policy unchanged.

Prerequisite rank-5 CI [37406155568](https://github.com/bakrmatlab/OTPGuard/actions/runs/37406155568)
passed. Exact prerequisite a103a6d CI
[37422001731](https://github.com/bakrmatlab/OTPGuard/actions/runs/37422001731) failed:
types/lint/build/audit passed, Prettier rejected the previous popup acceptance document;
unit/browser/packaging steps never ran. This diff includes only formatting correction
in that prior report. Remote CI has not been rerun/published for this local branch.

Initial harness attempts failed on sandbox local-server restrictions and missing
workspace dependency links; isolated package links were corrected. Source-checkout
check/build attempts also hit its existing missing entities/decode dependency. One
mistaken source build cleared the generated extension folder before failing; it was
restored byte-for-byte from the preserved prior automatic-finding-v1 configured artifact.
No env/configuration or installed extension changed. The restored folder is the preserved prior configured artifact; the original pre-build folder was not inventoried, so exact prior folder identity is unverified. Final validation/builds use only
the isolated export; prior configured /tmp artifacts remain intact.

## Reproduce without live mail

Run the insertion/core3 browser commands above. Fixtures demonstrate native React
single/split retention, a 200 ms delayed clear, an incompatible changed pattern,
a transient edit, field replacement and site-driven completion. Successful insertion
asserts DOM and framework state separately; expected refusal is never counted as a fill.
For manual fixture inspection use the loopback insertion page and its synthetic Fill
control. Never click a submit control. No configured rank-6 artifact is installed.

The 500 ms acknowledgment is bounded and conservative. Polling cannot detect every
silent transient mutation; later clearing and site/network/server completion remain
outside its claim. Refusal after partial insertion leaves values untouched and replay
reservations intact; it does not offer automatic reuse. Framework rerender replacement
requires new detection and confirmation. No representative live success rate is claimed.

## Owner publication approval

October 6, 2026: after reviewing the local result, the owner explicitly authorized
commit, merge and push of this rank-6 scope. The local validation and acceptance limits
above still apply. This authorization does not include deployment, provider changes,
live profile/mail access, rank 7 or another chat.
