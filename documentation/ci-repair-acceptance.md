# CI browser acceptance repair — October 5, 2026

Proposed title: `test: align browser acceptance with supported codes and popup layout`.
Local review scope only, based on main `7266d666cb862844a2cb17ceb97afb3163e27313`,
branch `codex/ci-browser-acceptance`. No production code, provider configuration,
permissions or installed artifacts changed. No publication or subsequent backlog
scope is authorized by this report.

## Findings and repair

Read-only `gh run view 37398472006 --log-failed` confirmed 68 passed, two failed
and one skipped in the [main CI run](https://github.com/bakrmatlab/OTPGuard/actions/runs/37398472006).
The insertion assertion treated `01a345` as invalid despite the accepted ASCII
alphanumeric contract. The local targeted reproduction failed in exactly that
way. The invalid-code case now uses `01$345`; all five refusals still require zero
input/change events and no field mutation. Existing production-content browser
cases retain mixed-code success and incompatible numeric-field refusal coverage.

The old native-popup assertion passed locally on macOS, while Linux CI reported
`innerWidth` 395 rather than 380. The working explanation is classic scrollbar
space in the native viewport. The test now measures the platform scrollbar width
using a temporary hidden element and allows precisely that space when the root
has vertical overflow. It still requires root client width and main width exactly
380, no horizontal overflow against the usable client width, and Fill width over 120. It does not accept an arbitrary viewport-width range. The test probe is removed
immediately and is not part of production. Linux's complete geometry has not been
measured locally; its revised assertion remains unverified until a Linux run.

## Validation

All build/test commands ran in a fresh provider-free source export at
`/tmp/otpguard-ci-repair`, using Bun 1.4.2 and Node 22.19.0 on macOS arm64.
Prefix for Bun commands: `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.
Provider files, configured builds and the owner's live browser/mailbox were preserved.

| Command                                                                                                                                      | Result                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                                                                                                              | Passed, 295 packages installed                                         |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                                                                                                    | Passed, extension and web                                              |
| `bun run build:mock`                                                                                                                         | Passed                                                                 |
| `bun run check`                                                                                                                              | Passed, types/lint/format and 646 tests in 41 files                    |
| `bun run test:browser --grep 'invalid codes\|native action popup'` before repair                                                             | Reproduced insertion failure; old native popup passed on macOS         |
| `bun run test:browser` after repair                                                                                                          | 70 passed, one skipped, zero failed                                    |
| `bun run test:browser --grep 'invalid codes\|native action popup'` after final probe formatting and stronger client-width overflow assertion | Two passed                                                             |
| `bun x --no-install prettier --check tests/browser/popup.spec.ts tests/browser/insertion.spec.ts`                                            | Passed on final sources                                                |
| `bun audit`                                                                                                                                  | Passed, no vulnerabilities in 367 packages                             |
| `bun run package:review`                                                                                                                     | Passed, provider-free extension/web archives and provenance            |
| `bun run check:packages`                                                                                                                     | Passed, extracted standalone routes/mobile/assets and MV3 worker/popup |
| `git diff --check`                                                                                                                           | Passed                                                                 |

The browser skip is the pre-existing configured Gmail denial/reconnect/mailbox-change/
revocation simulation, which requires configuration absent from the CI-equivalent
export. It is not a passing live lifecycle check. Initial export setup using the
host's Bun 1.2.22 and root-only dependency symlink failed to resolve workspace
dependencies; a pinned clean install replaced that setup. The initial sandboxed
advisory request failed DNS; the permitted network retry passed. These setup failures
are not remaining application failures.

## Acceptance and review boundary

Achieved locally: supported alphanumeric success remains covered; symbols and
incompatible lengths refuse without mutation/events; native popup retains 380px
usable content; full synthetic browser coverage and the packaging checks previously
omitted by CI failure pass. No architecture decision or ADR is needed for assertion
maintenance. No release, freshness, ambiguity, replay or explicit-Fill gate changed.

Unverified: revised Linux CI, configured-Gmail simulation, live provider lifecycle/
privacy and representative live success rates. Reproduce locally with the commands
above in a provider-free export; on Linux the native-popup case must also pass with
classic scrollbars. Rank 2 (challenge/resend tracking) is the next owner-review scope
and has not started. Stop for owner review of this local diff.

## Owner publication authorization

After reviewing both local scopes, the owner explicitly requested committing,
merging and pushing the CI repair and challenge tracking, then starting timing/
provider work. This supersedes the earlier local-only publication boundary for
these two scopes. Linux CI verification follows the authorized push; live
configuration/acceptance limitations remain unchanged.
