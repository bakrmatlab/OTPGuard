# Bounded retrieval/MIME coverage — October 5, 2026

Proposed title: `fix(extension): retrieve bounded complete generic mail sets`.
Local rank-4 branch: `codex/bounded-retrieval-mime`, from published main `5e3accc`.
Owner authorized local implementation/validation after rank 3 publication. No rank-4
commit, push, remote PR, merge, deployment or owner-profile/provider access performed.

## Result and acceptance

| Criterion                              | Result                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Busy mailbox/pagination                | Achieved synthetically: complete two-page twelve-message set finds one code among readable ordinary mail; no partial list reaches selection                                           |
| Hidden competition                     | Achieved: two plausible codes on the later page refuse; unreadable newsletter-like competitor now refuses instead of releasing the readable code                                      |
| Category coverage                      | Generic time-only query includes spam/trash; no inbox/unread/sender/keyword filter; provider behavior tested with synthetic responses, live categories unverified                     |
| Cap boundaries                         | Achieved: 49/50 IDs succeed, 51 refuse before body fetch; repeated/invalid tokens and five-page overflow refuse                                                                       |
| Resource/time/cancellation             | Achieved: four-read concurrency, aggregate response cap, stalled header/body cancellation, ten-second streamed-body timeout, thirty-second cycle expiry and sibling abort regressions |
| Mail arriving/indexed during retrieval | Achieved within visible provider results: changed closing ID set refuses/retries; existing empty-mail/late-delivery polling regressions retained                                      |
| MIME coverage                          | Achieved: padded/folded transfer encoding accepted, differing alternatives still ambiguous; existing charset/byte/boundary/part/depth/resource cases retained                         |
| Required Fill/fresh authority/replay   | Retained in connected/coordinator/browser regressions; generic matches remain CANDIDATE; no extension submission                                                                      |
| Privacy/artifact boundaries            | Source and synthetic artifact checks passed; minimal response fields, time-only query, no snippet exclusion/new persistence/permission/cloud traffic                                  |
| Live provider/site/server acceptance   | Unverified: no owner mail/browser, grants, configured installed build or server login accessed                                                                                        |

[ADR0028](adr/0028-bounded-complete-generic-retrieval.md) records the decision and
supersedes ADR0023's unreadable-newsletter exclusion. Generic cycles enumerate up to
fifty unique IDs across five pages of twenty entries, fetch all with four workers,
and repeat the enumeration after a nonempty fetch. A changed ID set is a retryable
cycle failure, not permission to choose the newest code. Up to ten list and fifty
body calls per successful cycle share 8 MiB aggregate streamed JSON, 512 KiB response,
256 KiB raw MIME, thirty-second cycle and ten-second per-request bounds. The existing
sixty-second search and polling schedule still bound retries. Historical reviewed
transport remains ten bodies/no pagination and keeps its category/MIME contract.

Main components: `apps/extension/gmail/transport.ts`, `gmail/retrieval.ts`, generic
coordinator envelope cap, shared retrieval limits, and generic raw transfer-token
normalization. No detector, input insertion, release policy, replay ledger, provider
setup, dependency or manifest changes. `clearlyUnrelatedMail` and its obsolete unit
acceptance were removed; composed connected refusal now covers the actual boundary.

## Validation

Fresh provider-free export: `/tmp/otpguard-retrieval-review`, created from `git archive
HEAD` plus only this scope's changed source/tests/documentation. Owner env files,
configured/installed builds and other worktrees were not copied or altered.
Bun 1.4.2 and Node 22.19.0 on macOS arm64. Command prefix:
`PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.

| Command                                                                                                   | Outcome                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                                                                           | Passed                                                                                                                  |
| Baseline `bun x --no-install vitest run tests/retrieval-coverage.test.ts`                                 | Four reproduced failures: pagination, >10 IDs, invalid-token schema and padded MIME; three refusal cases already passed |
| Baseline `bun x --no-install vitest run tests/generic-fill.test.ts -t unreadable-newsletter`              | Reproduced unsafe FILLED instead of required UNKNOWN despite unreadable competing content                               |
| Final focused `bun x --no-install vitest run tests/retrieval-coverage.test.ts tests/generic-fill.test.ts` | Passed: 105 tests                                                                                                       |
| `bun run check`                                                                                           | Passed: types/lint/format and 693 tests in 43 files                                                                     |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                                                                 | Passed: provider-free production extension and web                                                                      |
| `bun run --filter @otpguard/extension build`                                                              | Passed on final production source                                                                                       |
| `bun run build:mock`                                                                                      | Passed                                                                                                                  |
| `bun run test:browser` against final artifact                                                             | 71 passed, one skipped, zero failed                                                                                     |
| `bun run package:review`                                                                                  | Passed: credential-free extension/web review ZIPs and provenance                                                        |
| `bun run check:packages`                                                                                  | Passed: extracted standalone routes/mobile/assets and MV3 worker/popup                                                  |
| `git diff --check`                                                                                        | Passed                                                                                                                  |
| Prerequisite rank-3 Linux CI run 37402477865                                                              | Passed all steps, including browser/packaging                                                                           |

The browser suite's existing configured Gmail denial/reconnect/mailbox/revocation
simulation is skipped because this export has no provider configuration. It is not
live acceptance. Browser tests use isolated profiles with trace/screenshot/video off.
The initial browser launch could not start its sandboxed local server; the permitted
isolated rerun passed. The agent-browser CLI was unavailable; repository Playwright
and extracted-package checks verified rendering/behavior instead.

An intermediate full check ran before artifact builds, producing four missing-artifact
failures, plus nine stale fetch-count assertions after the new closing list call.
Those follow-up tests now require exactly list/body/closing-list and still assert
that stalled admission starts no new search. No authority gate was weakened. After
builds/assertion updates, the check passed 691 tests; two additional timeout/sibling
failure tests bring the final population to 693; the final full check passed.

Review artifacts remain provider-free and are not installed:
`/tmp/otpguard-retrieval-review/apps/extension/build/chrome-mv3-prod` and
`/tmp/otpguard-retrieval-review/dist/review/extension.zip` / `web.zip`.
The build is not a configured replacement for the owner's extension.

## Reproduction and residual limits

Run the focused test command above to reproduce twelve recent messages across two
pages with one candidate, then two candidates on the later page: the first fills only
after the synthetic explicit confirmation; the second never releases. The unreadable
newsletter case has another code in its unseen body and an ordinary short snippet;
it must report a MIME refusal. Cap/timeout/late-indexing tests require refusal without
returning any partial set. These are synthetic cases, not representative live trials.

For later owner-controlled acceptance, privately request one fresh code on a supported
top-level native HTTPS input, confirm it stays empty before Fill, then click Fill.
Record only insertion/refusal and server completion separately; retain no mail/code/
token screenshots or logs. Genuine two-message competition must refuse. No such live
run was performed or configured build installed by this scope.

Gmail search is not an atomic snapshot. A closing enumeration catches visible changes
while bodies are fetched, but cannot prove all provider indexing is complete or catch
mail indexed after the check/during confirmation. Busy mailboxes beyond caps and any
eligible unreadable message deliberately refuse, so coverage is broader but not universal.
Sent/draft/archive labels are not trust or exclusion evidence. MIME attachments with
text, forwarded/replied mail, encrypted/unsupported containers and invalid encodings
remain outside accepted coverage. Binary/images remain inert and never execute/load.

Late old mail inside a fresh receipt window can still appear plausible. Concurrent
same-mailbox challenges still lack reliable transaction identity. Existing recipient/
length/service heuristics are forgeable and are unchanged. A single wrong generic
candidate remains possible; no sender-to-site verification or newest-code selection.
Support remains English wording, 4–8 ASCII alphanumeric, numeric space grouping and
exact 3–3 hyphen presentation, with top-level native HTTPS inputs. Frames, shadow roots,
other languages, longer codes/symbols remain unsupported. Cloud history/device sync
remain disabled/unconfigured. Live privacy/lifecycle acceptance and live success rates
remain unverified. A synthetic Fill does not imply server login completion.

Rank-4 Linux CI remains unverified; this local-only scope was not pushed to trigger it.
The local planning references under ignored `docs/` were updated separately; tracked
acceptance/ADR/privacy/design notes contain the reviewable decisions.

Stop for owner review. No later reliability scope started.

## Owner publication authorization

After reviewing this scope, the owner explicitly requested committing, merging and
pushing rank 4. This supersedes the earlier local-only publication boundary. Live
acceptance and residual limits remain unchanged; no deployment or later scope is
included. Linux CI after publication is a separate check, not inferred from local tests.
