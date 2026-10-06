# Popup admission repair — October 6, 2026

Proposed title: `fix(extension): enable fresh-install finding and bound admission progress`.
Local branch: `codex/stalled-admission-popup`, from published rank-5 main `2398513`.
Owner reported the configured extension remaining in “Looking for your code” for
117 seconds and requested continuation. This authorizes this local repair/artifact,
not a later reliability rank, publication, provider change or deployment.

## Result and acceptance

| Criterion                                 | Result                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completed admission refusal               | Achieved synthetically: foreground/email-flow refusal finishes the admitting display and reports page unavailable                                             |
| Browser foreground consistency            | Achieved: one final live browser check controls the returned context; unfocused requests refuse and a fresh focused attempt succeeds                          |
| Admission after delayed worker timer      | Achieved: status reads enforce the existing 60-second deadline, display cancellation and abort actual pending admission                                       |
| Late success after expiry                 | Achieved: late context completion starts neither retrieval nor release                                                                                        |
| Retry/challenge/replay                    | Achieved in regressions: status expiry retains the original challenge window; existing replay and required-Fill gates remain unchanged                        |
| Accurate progress boundary                | Achieved: final fresh account/mailbox/browser checks announce their stage; concurrent operations can still interleave                                         |
| Configured artifact                       | Built with existing public Clerk/Gmail/Convex configuration and registered extension ID; previous configured artifacts preserved                              |
| Live owner stall root cause / fresh login | Unverified: reproduced bugs match indefinite searching, but the screenshot does not establish the exact live browser/provider race; fresh owner retest needed |

[ADR0030](adr/0030-finished-and-bounded-admission-display.md) records the decision.
Production changes are confined to coordinator/worker admission reporting and progress
labels in connected account/mailbox wrappers. `tests/prompt.test.ts` adds six seam
regressions: completed refusal, final foreground consistency, status-only display expiry,
actual admission abort/late success, the later fresh-account stage and Retry window
preservation. No popup presentation, detector, recipient/MIME parser, provider grant,
permission, replay storage, dependency or backend change.

## Validation

Tests/builds ran in the provider-free `/tmp/otpguard-recipient-review` source export
with only the repair's source/test/documentation updates. Owner env files/builds and
other worktrees were preserved. Runtime: Bun 1.4.2 and Node 22.19.0, macOS arm64;
command prefix `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.

| Command                                                                                                                                               | Outcome                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `bun x --no-install vitest run tests/prompt.test.ts -t 'finishes admission display'`                                                         | Reproduced SEARCHING at 117 seconds after an already completed refusal                                                                        |
| Baseline `bun x --no-install vitest run tests/prompt.test.ts -t 'admission\|foreground check'`                                                        | Three intended failures: indefinite display, contradictory foreground context and ignored status-read expiry; one passed, 18 filtered/skipped |
| `bun x --no-install vitest run tests/prompt.test.ts`                                                                                                  | Passed: 25 tests, including six new regressions                                                                                               |
| Admission-repair `bun run check`                                                                                                                                 | Passed: types/lint/format and 786 tests in 44 files                                                                                           |
| `bun run --filter @otpguard/extension build`                                                                                                          | Passed: provider-free production repair artifact                                                                                              |
| Existing configured builder with isolated dependency-link correction                                                                                  | Passed: `/tmp/otpguard-popup-admission-repair-v1/apps/extension/build/chrome-mv3-prod`                                                        |
| `OTPGuard_ARTIFACT=/tmp/otpguard-popup-admission-repair-v1/apps/extension/build/chrome-mv3-prod bun x --no-install vitest run tests/manifest.test.ts` | Five configured artifact/permission/fixture-isolation checks passed                                                                           |
| `OTPGuard_ARTIFACT=… bun run test:browser`                                                                                                            | 78 passed / one skipped / zero failed; production-content cases use the configured repair; default popup cases use the provider-free artifact |
| `bun /tmp/otpguard-repair-configured-popup-check.ts`                                                                                                  | Three passed; isolated UI-only provider simulations with no live OAuth                                                                        |
| `bun run package:review`                                                                                                                              | Passed: fresh provider-free review ZIPs/provenance                                                                                            |
| `bun run check:packages`                                                                                                                              | Passed: extracted standalone routes/mobile/assets and MV3 worker/popup                                                                        |
| Source/artifact identity, local document links, `git diff --check`                                                                                    | Passed: source/export/artifact identity, resolving local links and clean diff whitespace                                                      |

The full browser suite's existing configured Gmail simulation was skipped because
that harness run has no provider configuration. It is run separately with the exact
configured repair artifact and public configuration supplied to the test harness.
No live mailbox, owner-profile browser, code or token was read. Browser trace/video/
screenshots are off. The agent-browser CLI remains unavailable; repository Playwright
provides browser/artifact verification. No web application source changed; its prior
provider-free production build supplies unchanged browser/packaging fixtures.

Initial test-harness issues were corrected: one invocation used the source checkout
with missing `entities/decode`; no bug assertion executed there. The isolated export
reproduced the intended failures. An incomplete Chrome window test type and a missing
union guard in a progress assertion were fixed; final checks use strict types. No
production check or release gate was weakened to pass these tests.

## Artifact and owner retest

Configured artifact (not installed by the agent):
`/tmp/otpguard-popup-admission-repair-v1/apps/extension/build/chrome-mv3-prod`.
This is a fresh extension-only export containing the current recipient implementation
plus this repair. Existing registered ID, public configuration and provider hosts are
retained. Previous configured and provider-free artifacts are preserved. No secrets or
owner env files were copied. Source/configured artifact hashes are recorded locally in
`/tmp/otpguard-popup-admission-repair-v1/repair-artifact-provenance.json`.

Update the existing unpacked extension to this folder under the same ID, then reload
the login page so its content script is current. Start one fresh email-code challenge.
The field must remain empty until an extension-owned Fill click. Searching must stop
within the existing 60-second search/admission limit when no result is available;
if a provider/browser operation stalls, the progress stage should identify its boundary
and timeout should refuse. Report only the status text and insertion/server completion
separately. Do not retain email/code/token screenshots or logs.

This repair does not establish that the original live stall was solely a focus race,
that provider calls are fast, or that the new attempt will find the intended mail.
Timeout is refusal, not successful filling. Underlying callbacks may complete after
detachment but cannot resume an expired admission. Interleaved diagnostics and broader
worker/concurrent display behavior remain limited. Late old-mail identity, same-mailbox
concurrent challenge ambiguity, complete provider indexing, lifecycle/privacy live
acceptance and representative success rates remain unresolved.

Generic support stays 4–8 ASCII alphanumeric with existing grouped presentations,
English wording and top-level native HTTPS inputs. CANDIDATE never becomes sender-to-
site verification. Required Fill, fresh account/mailbox/browser/field authority,
genuine ambiguity refusal, write-ahead replay refusal, 60/30/15 phase bounds and rank-4
complete-set/decoder/resource rules remain. No newest-code choice, expiry bypass,
replay clearing or extension submission. Cloud history/device sync stay disabled/
unconfigured. Synthetic Fill is not proof of live success or server completion.

Stop for owner review and fresh retest. No commit, merge, push, deployment or next rank.

## Owner-reported resolution — October 6, 2026

The owner subsequently reported that the extension works after enabling “Automatically
find codes and show the Fill prompt”; that preference had been unchecked. This records
owner-reported functional resolution after a settings correction. No mail, code, token
or screenshot is retained. Insertion and server completion were not separately reported,
so this does not establish a live success rate or complete the broader acceptance matrix.

The additional account-stall investigation was stopped. No account refresh/cache/provider
change was implemented following that investigation. The independently reproduced local
admission-display repairs remain uncommitted for review; this result does not establish
that they caused the live resolution or authorize publication, deployment or a later rank.

## Owner-requested automatic-finding default — October 6, 2026

The owner then asked for automatic finding without checking a preference box. This
extends the same uncommitted local review; proposed combined title:
`fix(extension): enable fresh-install finding and bound admission progress`.
[ADR0031](adr/0031-automatic-finding-default.md) records the narrowly scoped default.

Fresh, successfully saved installations now default to automatic finding enabled.
Previously saved preferences/blocks are preserved; pre-init, corrupt, unreadable or
unwritable storage stays unavailable/disabled. This does not grant Chrome/Gmail access,
activate cloud history/sync, insert a code without Fill, or change any release check.
The checkbox remains an optional opt-out. The shared historical/cloud default remains
false, with only new local installation initialization changed.

Additional validation on final combined source:

- `bun run check`: passed types/lint/format and 788 tests in 44 files; fresh-default/saved-opt-out unit tests plus
  retained storage failure, policy-expansion refusal and all pipeline regressions.
- Configured `tests/manifest.test.ts`: five passed.
- Full `bun run test:browser`: 79 passed, one configured-provider case skipped in the
  provider-free suite (covered by the separate configured popup simulations), including an actual fresh MV3
  installation that starts checked, retains no HTTPS grant, keeps Fill disabled, and
  remembers an explicit opt-out after reload.
- Configured popup simulations: three passed. Provider-free packaging and extracted-package checks passed.

Intermediate test assertions were corrected: an old policy-expansion test now explicitly
starts with a saved opt-out, and the browser test uses click plus an awaited state
assertion for the asynchronously controlled checkbox. The older foundation browser test now expects the requested default and still checks both opt-out and re-enablement persistence. No production policy was weakened.

Newest configured artifact, not installed by the agent:
`/tmp/otpguard-automatic-finding-v1/apps/extension/build/chrome-mv3-prod`.
It retains the existing public Clerk/Gmail configuration and registered extension ID,
and includes the admission repairs above. Prior artifacts are preserved. Live acceptance
of this particular artifact is pending; the owner's earlier success is settings-resolution
evidence rather than acceptance of this additional default change.

No account-stall repair, commit/merge/push, deployment or later reliability rank is added.
