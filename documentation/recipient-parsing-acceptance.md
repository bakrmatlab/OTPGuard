# Structured recipient parsing — October 5, 2026

Proposed title: `fix(extension): preserve uncertainty in structured recipient hints`.
Local rank-5 branch: `codex/recipient-parsing`, from published main
`5d527f6d257ef166ec7d896641e53139040af20c`. Owner authorized local implementation and
validation only. No rank-5 commit, merge, push, remote PR, deployment or live profile access.

## Result and acceptance

| Criterion                               | Result                                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured recipients                   | Achieved synthetically: quoted/display names, nested comments, folded To/Cc/Bcc, multiple addresses/groups, ASCII atext and quoted local variants                                                           |
| No address-looking display/comment text | Achieved: only structural mailbox addresses contribute; comment/display decoys cannot create a match                                                                                                        |
| Incomplete/unsupported lists            | Achieved: malformed members, duplicate/empty fields, undisclosed groups, Unicode addr-specs/domain literals/obsolete routes and overflow supply no exclusion evidence                                       |
| Alias scope                             | Achieved: personal Gmail dot/plus and existing googlemail spelling; literal Workspace/custom-domain dots/tags; non-Gmail case-only differences remain uncertain                                             |
| Page/protocol seams                     | Achieved synthetically: full standalone rendered tokens, inline/block boundaries, valid punctuation/quoted local variants; malformed/masked/multiple/Unicode tokens omit the hint while detection continues |
| Connected competing codes               | Achieved: uncertain recipient evidence retains competition; genuine visible contradictions exclude; Cc/Bcc matches retain competition; unreadable uncertain mail still refuses                              |
| Coordinator defense                     | Achieved: malformed alternate-adapter recipients cannot be treated as explicit differences                                                                                                                  |
| Release/privacy invariants              | Retained in full regressions: CANDIDATE, required Fill, fresh authority/exact fields, ambiguity/replay refusal, timing/retrieval caps and no extension submission                                           |
| Live provider/site/server acceptance    | Unverified: no owner mail/browser, grants, installed build or server login was accessed                                                                                                                     |

[ADR0029](adr/0029-structured-recipient-hints.md) records syntax, bounds, uncertainty and
alternatives. The parser returns complete addresses or no recipient exclusion evidence;
it never silently retains a partial list. The contradiction boundary validates both
sides and every envelope member. Unsupported addresses can still be in otherwise
readable mail; that mail remains plausible under the existing generic code contract.
Missing/uncertain evidence alone is not a message exclusion or a decoder bypass.

Changed production components: `packages/otp/addresses.ts`, raw recipient hints,
`packages/security/generic.ts`, Gmail retrieval, coordinator selection, detection schema
and rendered page hints. New regressions: `tests/recipient-parsing.test.ts` and seven
production-content cases in `tests/browser/core3.spec.ts`. Sender/service heuristics,
MIME candidate support, query/permissions/provider configuration and dependencies are
unchanged. No new persistent data, logs, external endpoint or backend payload.

## Validation

Fresh provider-free export: `/tmp/otpguard-recipient-review`, created from `git archive
HEAD` plus only this scope's changed files. Existing pinned dependencies were copied
from the prior provider-free export, then `bun install --frozen-lockfile` verified the
lockfile and workspace links. Owner env files, installed/configured artifacts, other
branches/worktrees and credentials were preserved. Bun 1.4.2 / Node 22.19.0 on macOS
arm64; command prefix `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.

| Command                                                                                                                                                                        | Outcome                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gh run view 37404175125 --json status,conclusion,headSha,jobs`                                                                                                                | Passed prerequisite: Linux CI completed successfully on the exact baseline; all steps including browser/packaging passed                                            |
| `bun install --frozen-lockfile`                                                                                                                                                | Passed; 307 installs / 389 packages verified                                                                                                                        |
| Baseline `bun x --no-install vitest run tests/recipient-parsing.test.ts`                                                                                                       | Twelve failures in initial 18 cases reproduced substring/comment/quoted-local/partial-list/alias defects                                                            |
| Baseline `bun x --no-install vitest run tests/recipient-parsing.test.ts -t 'connected\|coordinator'`                                                                           | Five failures: two unsafe competing-code releases, two decoy false ambiguities, one malformed-envelope unsafe release; two passed, 18 deliberately filtered/skipped |
| Baseline `OTPGuard_ARTIFACT=/tmp/otpguard-retrieval-review/apps/extension/build/chrome-mv3-prod bun run test:browser --grep 'production recipient hint preserves uncertainty'` | Five failed / two passed; real production content reproduced truncation, missing quoted local and local-case loss; no owner data                                    |
| Final `bun x --no-install vitest run tests/recipient-parsing.test.ts`                                                                                                          | Passed: 87 tests                                                                                                                                                    |
| Final `bun run check`                                                                                                                                                          | Passed: type/lint/format and 780 tests in 44 files                                                                                                                  |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                                                                                                                                      | Passed: provider-free web/extension; final extension rebuilt separately below                                                                                       |
| `bun run --filter @otpguard/extension build`                                                                                                                                   | Passed on final production source                                                                                                                                   |
| `bun run build:mock`                                                                                                                                                           | Passed                                                                                                                                                              |
| Final `bun run test:browser`                                                                                                                                                   | Passed: 78 passed / one skipped / zero failed against final rebuilt artifact                                                                                        |
| `bun run package:review`                                                                                                                                                       | Passed: provider-free extension/web ZIPs and provenance                                                                                                             |
| `bun run check:packages`                                                                                                                                                       | Passed: extracted standalone routes/mobile/assets and MV3 worker/popup                                                                                              |
| `git diff --check` / source-export identity / documentation links                                                                                                              | Passed; changed production/test files match validated export byte for byte; local Markdown links resolve                                                            |

Initial harness errors were resolved: one invocation ran in the source checkout where
`entities/decode` was absent (no tests ran); copied dependencies initially lacked the
security workspace link until frozen installation repaired it. A test named the schema
function incorrectly; that and an intermediate protocol parenthesis edit were corrected.
The final malformed-group test initially had unnecessary quote escapes rejected by lint;
those test escapes were removed. None required weakening authority or refusal gates.

The first sandboxed browser attempt could not start the local web server and executed
no tests; permitted isolated execution supplied the red/green browser evidence. The
agent-browser CLI was unavailable; repository Playwright verifies actual built content,
DOM and popup behavior. Browser trace/video/screenshots are off. The one pre-existing
configured Gmail denial/reconnect/mailbox/revocation simulation is skipped because this
export has no provider configuration. That simulation is not live provider acceptance.
Rank-5 Linux CI is unverified because this scope is not published; prerequisite rank-4
CI success is separate evidence.

Review artifacts are provider-free and were not installed:
`/tmp/otpguard-recipient-review/apps/extension/build/chrome-mv3-prod` and
`/tmp/otpguard-recipient-review/dist/review/extension.zip` / `web.zip`.
They are not configured replacements for the owner's installed extension.

## Reproduction and remaining limits

Run the focused test command above. A synthetic recent code addressed to the page
plus another code with an incomplete recipient list must return UNKNOWN with no release.
Replace that list with a complete different recipient: only the remaining code may be
offered, still requiring Fill. A matching address in a comment/display name alone must
not keep a genuinely different address plausible. Cc/Bcc matches and malformed members
must preserve competition. Unknown recipients on unreadable mail cannot skip decoding.
Production browser tests separately verify supported address characters and uncertainty
against rendered text, including inline/block address fragments; fields stay empty.

A bounded RFC subset is supported, not every valid mail representation. Unsupported
recipient evidence includes obsolete routes/addresses, domain literals, internationalized
local parts/Unicode domains, comments inside dot atoms, overlong addresses/lists and
excessive nesting. Page hints are stricter: attached prose punctuation/wrappers and
space-containing quoted local parts omit the hint. Personal Gmail base syntax outside
the understood alphanumeric/dot form is uncertain when not exactly equal. Unknown
provider-specific aliases are not inferred or learned. Local-part case-only differences
outside personal Gmail never establish an explicit contradiction.

Visible To/Cc/Bcc is forgeable matching evidence, not the SMTP envelope or authenticated
delivery identity. Bcc may be absent, and forwarding/group/provider aliases can obscure
the actual recipient. Different visible addresses can still reach the same mailbox.
The existing generic contract can offer one wrong candidate and cannot prove sender-to-
site trust or server challenge identity. Missing/uncertain evidence preserves ambiguity
but cannot establish hidden provider indexing completeness. No newest-code choice.

Late old mail within a fresh receipt window and concurrent same-mailbox challenges
remain imperfect. The 60-second search / 30-second confirmation / 15-second fresh release
budgets, five-minute freshness, complete bounded retrieval and replay reservations remain.
Support stays English wording, 4–8 ASCII alphanumeric, numeric space grouping and exact
3–3 hyphen presentation on top-level native HTTPS inputs. Frames/shadow roots, other
languages/longer codes/symbols remain unsupported. Optional cloud history/device sync
remain disabled/unconfigured. Broader live lifecycle/privacy acceptance and success rates
remain unverified. Synthetic Fill is not a live success-rate or server-completion claim.

Any later live retest must be owner-controlled and separately authorized: privately
request one fresh code, verify an empty field before Fill, click Fill and report insertion
and server completion separately without retaining mail/code/token artifacts. No such
trial or owner-profile access occurred in this scope.

Stop for owner review. The next queued input-compatibility scope is not started.

## Owner publication authorization

After reviewing the local rank-5 results, the owner explicitly requested committing,
merging and pushing this scope. This supersedes the preceding local-only publication
boundary. Live acceptance and residual limits remain unchanged; no deployment or later
scope is authorized. Post-publication Linux CI is separate evidence from local checks.
