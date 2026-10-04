# Toolchain and extension package remediation

This first-stage record is superseded for packaging and registry-bootstrap acceptance by
[local release completion](local-release-readiness.md). Its results below are historical.

October 3, 2026, local review on `codex/toolchain-package-remediation`, based on
`3e6334edb3e0e093dfd5ff13d6ed4c5da6670233`. Owner requested fixes after the
[full-app review](deployment-review.md). This is one unnumbered remediation scope;
the existing numbered plan ends at16. Proposed title:
`fix(build): replace vulnerable extension toolchain and reduce package size`.

## Result

| Finding                  | Before                                | After / disposition                                                                                                                                   |
| ------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 dependency advisories | 19:8high/10moderate/1low; audit exit1 | 0 in current locked audit, exit0; addressed by removing Plasmo/Parcel and its dependency tree, without forced upgrades                                |
| S2 excessive artifact    | 312,398,760 bytes/73files             | 2,561,687 bytes/6files, about99.18% smaller; artifact size addressed and guarded below25MiB. Broader live/store/update performance remains unverified |
| S3 stale local plan      | PR15 pending/PR16 unstarted           | Local plan reconciled to integrated commits and this owner-requested scope; ignored records remain local                                              |

The extension uses Bun's explicit browser bundler and a React popup entry. The builder
emits only background/popup JS, popup CSS/HTML, existing icon and a closed manifest.
It preserves the same reviewed configuration/permission/CSP functions, worker-owned
Clerk client and account freshness/no-cache gates. Only seven legacy public env names
and `NODE_ENV` are embedded. A nonempty production content entry refuses build.
The existing `build/chrome-mv3-prod` path and `PLASMO_PUBLIC_*` names are retained for
registered identity and setup compatibility. No Gmail key/client/ID was regenerated.

Removed package: Plasmo0.90.5, with its Parcel/native/transitive tooling. Locked package
count919→388. No dependency override or compatible-version assumption was used.
Native install trust entries for removed lmdb/msgpackr-extract were removed. CI keeps
the same frozen install/build/check/browser sequence, without obsolete Plasmo telemetry.
Hot reload remains unavailable; use production build/reload.

This removes the vulnerable toolchain, not the connected-product blockers. Production
content and registry remain empty; sender/receipt remain unverified; real retrieval/fill,
manual fill/retry/site access and cloud transport/history remain disabled. Live provider,
real template/site and public distribution work from the review is still required.

## Acceptance and validation

Commands used Node22.19.0/Bun1.4.2 with
`PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`. Builds/tests ran in provider-free
`/tmp/otpguard-remediation`, copied from committed source plus reviewed local changes.
Owner env/build files and Chrome profile were not modified or used for live requests.
Existing port3000 server was left untouched; browser tests used3100/3001.

| Check                                                                              | Result                                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original artifact size probe                                                       | Failed as expected at312,398,760 bytes versus25MiB provisional budget                                                                                                     |
| New `tests/manifest.test.ts` size regression before fix                            | 1failed/4passed; measured original artifact                                                                                                                               |
| Isolated `bun build apps/extension/background.ts --target browser --minify`        | 2.4MB worker; supports bundler diagnosis before replacement                                                                                                               |
| `bun install --lockfile-only --offline`                                            | Passed locked dependency removal; no provider provisioning                                                                                                                |
| `bun install --frozen-lockfile --offline` in isolated export                       | Passed294 local-platform installs; cached dependencies, not new-machine network bootstrap                                                                                 |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                                          | Passed web and new MV3 build                                                                                                                                              |
| `bun run build:mock`                                                               | Passed separate synthetic artifact                                                                                                                                        |
| `bun run check`                                                                    | Passed types/lint/format and284 tests/19files, including size/permission/fixture isolation                                                                                |
| `bun run check:convex`                                                             | Passed types and16 actual offline tests/2files                                                                                                                            |
| `bun run test:browser`                                                             | 29passed/1configured-only skip; actual loaded new worker/popup, persistent preferences/history, no external default requests, synthetic safe/refusal/cancellation/restart |
| Synthetic public Gmail configuration build                                         | Passed temporary generated public key/ID/client only; owner registered configuration untouched                                                                            |
| `bun run --env-file=.env.synthetic-gmail test -- tests/manifest.test.ts`           | 5passed with matching configured manifest/configuration                                                                                                                   |
| `bun run --env-file=.env.synthetic-gmail test:browser tests/browser/gmail.spec.ts` | 3passed; identity/fetch doubles, no live OAuth/network acceptance                                                                                                         |
| Non-allowlisted synthetic env marker build/scan                                    | Passed marker absent from all artifact files                                                                                                                              |
| Nonempty content-entry probe                                                       | Builder refused with explicit registration-review error as expected; temporary source restored                                                                            |
| `bun audit --json`                                                                 | Passed public npm registry,{} /0advisories                                                                                                                                |

The baseline copy attempt using a wrong relative path failed harmlessly; no owner artifact
was involved. The new default artifact was rebuilt after configured acceptance.
Final frozen setup checked306 installs across388 packages with no changes; default
rebuild and full check again passed284 tests. Formatting, all public relative links and
`git diff --check` passed. The default ZIP is827,713 bytes with6entries and manifest at
root; extracted-package cold Chromium/worker/popup startup measured613/524/516ms on
this machine across3disposable profiles, with no external requests and fill disabled.
This includes browser launch, not a calibrated worker-only benchmark or update-cost test.
Final public npm audit again returned{} /exit0. Both Standards and Spec source reviews
reported no actionable regressions; reviewers did not independently rerun validation.

Clerk live configuration, Google live revoke/switch/consent, real receiver/template
evidence, production fill, deployed backend/JWT/two-device/scheduler/backup behavior,
network bootstrap/Linux/hosted CI, actual toolbar, assistive-technology speech and
store/provider approvals remain unverified. A successful synthetic configured build
is configuration regression evidence only. The remaining small worker still includes
installed Clerk code; no unsupported provider shim or remote-code fallback was added.

To review: follow [setup/demo](setup-demo.md) in a provider-free clone, inspect the six
default artifact files and manifest, load in a disposable profile, persist preferences
while confirming fill stays disabled, and exercise the separate synthetic mismatch flow.
No account/provider setup is needed. Rerun current audit; advisories can change.

No commit, merge, push, remote PR, deployment, provider provisioning or additional chat.
Stop after this scope for owner review. Next owner-selected scope should resolve
sender/receipt feasibility or compatible account transport before connected integration.
