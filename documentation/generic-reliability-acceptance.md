# Generic fill reliability — blockers 1–7

Scope: owner-selected local generic-fill PR, branch codex/generic-confirmed-fill.
Base e156a81ff71eda8c1e290599ea59099cea845feb. Design: ADR0022 and ADR0023.

| Blocker                      | Implemented behavior                                                                                                   | Acceptance evidence                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1. Unrelated unreadable mail | Strong ordinary-mail subject/snippet can exclude a decoder failure; unknown/OTP failures refuse                        | Connected retrieval with unreadable newsletter + valid code fills; unreadable code + valid code refuses                             |
| 2. MIME compatibility        | Delivery-header repetition, parameter spacing, charset aliases, encoded subjects, nested alternatives, unpadded base64 | Generic email format suites; conflicting headers/parameters, invalid bytes, unknown charset and forwarding still refuse             |
| 3. Large HTML                | Markup and extracted/aggregate text have separate caps                                                                 | Rich HTML >32 KiB normalizes; distinct alternatives remain ambiguous                                                                |
| 4. Detection                 | Large landing pages, ordinary text controls, split controls in separate wrappers, numeric length bounds                | Chromium fixtures; hidden/disabled/incomplete groups, uncertain authenticator flows and input overflow refuse                       |
| 5. Retained fill             | Native setters/events plus asynchronous retained acknowledgement                                                       | React single/split state and leading zeros; queued clearing/replacement, changed constraints, user input and cancellation refuse    |
| 6. Timing/resend             | Early request gesture, shared challenge window, preserved retry window, fresh resend boundary                          | Worker/engine tests and production-content gesture/resend browser cases; old approval cancelled, only fresh code released           |
| 7. Competing codes           | Receipt/length/recipient/service hints narrow candidates; unknown competition remains                                  | Different lengths/recipients/branded services disambiguate; opaque mail, true multiple codes, concurrent requests and replay refuse |

Validation commands and final results are appended after execution. Tests run from the
isolated source export /tmp/otpguard-generic-validation with pinned Bun 1.4.2 and its
installed lockfile dependencies. Source checkout dependencies were not reinstalled.
The configured owner review build and exact hashes are in generic-fill-artifact.json.

Live acceptance: Canva previously worked before this revision. Clerk previously reached
email decoding but refused charset; neither site has been retested against this revision.
No 99% coverage or perfection claim is established. No live mail, code or token was
captured. Existing unrelated owner documentation edits are preserved.

Owner test: load the recorded build, refresh the login page, request a fresh code, click
Fill and confirm that all fields retain the expected code. Repeat with resend on the same
fields and a delayed arrival. Verify Retry after a delayed form transition; verify typing
prevents overwrite and leaving the tab cancels release. Truly indistinguishable codes
should refuse. No extra per-site setup or sender/destination labels are added.

Final validation, October 5:

- `bun run check`: passed types, lint, formatting, 507 tests in 33 files.
- `bun ../../scripts/build-extension.ts` from the exported apps/extension: provider-free
  production build passed. Configured build from existing public configuration also passed.
- `bun run test:browser`: 46 passed, one skipped in 47 cases. The skipped configured
  Gmail lifecycle simulation requires configuration absent from the provider-free harness;
  it is not reported as passing live Gmail acceptance. The full run precedes the final
  omitted-charset UTF-8 normalization change; that change is covered in the final check
  and configured-artifact format/connected retrieval tests below.
- With `OTPGuard_ARTIFACT` set to the configured review path, `bun run test --
tests/manifest.test.ts tests/generic-fill.test.ts tests/generic-email-coverage.test.ts
tests/generic-reliability.test.ts tests/retrieval.test.ts`: 142 passed in five files.
- Configured-artifact `bun run test:browser tests/browser/core3.spec.ts`: seven passed,
  including request/resend/replacement behavior against the final content bundle.
- `git diff --check`: passed; no debug logging added. No production fixtures, additional
  permissions or backend mail flow introduced.

All seven rows above have synthetic acceptance achieved. Broad live compatibility,
real delivery timing, actual Canva/Clerk retention, and a measured 99% rate remain
unverified. The parser still supports English numeric 4–8 digit email codes in top-level
light DOM. Unknown potentially competing mail refuses. The owner-requested minimal
Code found / Fill interaction and explicit confirmation remain.

Local review delivery only; no commit, remote PR, publication, merge, deployment,
owner browser installation or provider grant change performed.

## October 5 review correction: invalidated content context

Owner supplied Chrome's `Uncaught Error: Extension context invalidated` on Clerk.
A production-content browser fixture reproduced the exact synchronous throw: the
existing promise catch never ran because Chrome threw before returning a promise.
The failing command was `bun run test:browser tests/browser/core3.spec.ts -g
"invalidated content"`; it produced two uncaught context-invalidated errors.

All content-script sends now catch synchronous and asynchronous failure, discard
approval and selected fields, stop timers/observation, and refuse subsequent sends.
No old approval can reconnect across an extension reload. Refreshing the website
is required after reloading/updating the extension; existing tabs retain old scripts.
This fixes the supplied exception, not proof of live Clerk email selection.

Validation in the exported pinned-runtime checkout: `bun run check` passed types,
lint, formatting and 507 tests. `bun run test:browser tests/browser/core3.spec.ts`
passed all eight cases against both provider-free and configured final builds.
Configured review artifact: `/tmp/otpguard-context-fix/apps/extension/build/chrome-mv3-prod`.
No installation, grants, publishing or merge performed. Live Clerk acceptance remains
unverified; refresh its tab, request a fresh code, then use Find code / Retry.

## October 5 review correction: delayed deadline callback

Owner still reports Searching after a fresh Clerk page. A deterministic coordinator
regression reproduced stale SEARCHING when the worker clock passes the request
deadline but its timer callback has not executed. The new status read expires
requests synchronously at the same deadline and reports cancellation. This is a
reproduced failure mode, not confirmation that Chrome delayed the owner's timer
or that Clerk's email has been matched. No new mail filtering or release rules.

`bun run check` in the exported pinned-runtime checkout passed all checks and 508
tests, including the regression (failed before correction, passed afterward).
Configured build passed at `/tmp/otpguard-search-deadline-fix/apps/extension/build/chrome-mv3-prod`.
The earlier eight browser results cover unchanged content; this coordinator change
has unit regression coverage. Owner live Clerk retrieval remains unverified.

## October 5 owner-requested request progress diagnostics

Added closed worker-owned stage labels for account/mailbox/page admission, manual
field detection, Gmail listing/fetching/poll waits, MIME decoding, candidate selection,
Fill approval, field preparation, replay reservation and retained insertion. Excluded
messages expose only timing/recipient/length/quoted/template/purpose/unrelated enums.
The popup shows elapsed seconds and a bounded last-12 stage trail under Request
progress. NO_CODE now says no code was selected rather than falsely asserting no
email arrived. Diagnostics are advisory last-observed events, not sender trust or
proof of a particular live failure. Concurrent checks may interleave stages.

Stage history and timing remain worker memory only and disappear at restart/new
admission. No mail content, codes, headers, identifiers, URLs, recipient values or
tokens enter diagnostics, app storage, logging, telemetry or backend. Existing enum
MIME/network failures and cancellation details remain. Release checks are unchanged.

Validation: exported pinned runtime `bun run check` passed types/lint/format and 510
tests; browser `bun run test:browser tests/browser/popup.spec.ts tests/browser/core3.spec.ts`
passed 12 cases including the stage trail and unrecognized-template label. The final
poll-wait marker is additionally covered by the repeated full check. Configured
production build passed at `/tmp/otpguard-progress-review/apps/extension/build/chrome-mv3-prod`.
Live Clerk selection remains unresolved; this diagnostic build is intended to identify
the failing stage without sharing personal mail. No installation/grants/publication.

## October 5 review: previous-page display and rapid per-email stages

Owner observed completed Canva status/timer on Clerk before entering an email.
Regression tests reproduced retained progress after tab activation and an elapsed
clock that continued after completion. Worker display is now hidden/reset on active
tab changes and on navigation of its last bound tab; a new admission/retry starts
fresh diagnostics. Terminal status reads freeze elapsed clocks and subsequent
progress updates; new admission resets them. This is display isolation, not a new
mail authorization rule. The production authorization still cancels on page changes.

Search main text is stable; individual message events remain in Request progress.
Exclusion labels say a recent message was excluded, not the requested Clerk message.
An exclusion event alone does not identify which email was excluded. Recipient
comparison and all release gates are unchanged; Clerk live selection remains unresolved.

`bun run check` passed types/lint/format and 512 tests, including the two regressions.
The final popup browser suite passed all four cases, including stable main text
and the revised exclusion wording. Provider-free and configured builds passed.
Final artifact: `/tmp/otpguard-progress-context-review/apps/extension/build/chrome-mv3-prod`.
No installation, grants, remote publishing, merging or deployment performed.

## October 5 review correction: frozen clock during new admission

Owner reported Clerk SEARCHING stuck at zero. Worker regression reproduced this
exact diagnostic pattern: a new account-check stage begins while coordinator status
still contains the previous FILLED result, and a popup status read freezes the new
clock. This was introduced by the preceding timer-display correction.

Removed freeze side effects from status reads. Actual coordinator terminal outcome,
cancellation or admission failure freezes progress instead. While admission is in
flight the worker returns SEARCHING, hiding the previous terminal result. Progress
updates cannot be stopped by a read of old status. Authorization/retrieval unchanged.

Pinned exported `bun run check` passed types, lint, formatting and 513 tests. The
new worker regression failed with 0 seconds/account stage before correction and
passes with 5 seconds/mailbox stage afterward. Configured production build passed
at `/tmp/otpguard-progress-clock-review/apps/extension/build/chrome-mv3-prod`.
This fixes a reproduced diagnostic regression; live Clerk code selection remains
unresolved, and detailed Request progress is required to identify that failure.
No installation, grants, publication, merge or deployment performed.

## Owner-authorized integration checkpoint — October 5, 2026

Owner requested committing, merging and pushing the current work and continuing the
unresolved Clerk issue in a new chat. Final pinned exported `bun run check` passed
all type/lint/format checks and 513 tests in 33 files. Provider-free production build
passed. Full synthetic browser suite passed 47 cases with one configured-Gmail
simulation skipped (48 total); no live browser or mail tests were performed.

This integrates generic user-confirmed filling and diagnostics with partial live
acceptance: owner reports Canva success, Clerk unresolved. Follow-up scope and
explicit owner-only live testing constraint are in clerk-continuation-handoff.md.
No additional provider grants, owner installation or deployment requested/performed.
