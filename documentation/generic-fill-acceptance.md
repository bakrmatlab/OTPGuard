# Generic user-confirmed email-code filling — local review

Date: October 5, 2026, America/Toronto.
Proposed PR: `feat(extension): support generic user-confirmed email codes`.
Branch: `codex/generic-confirmed-fill`, from `e156a81`.
Owner selected implementation after approving generic matching, no per-site setup,
and a Code found / Fill prompt without sender/destination labels. No publishing,
merge, deployment, installation change or Google grant changes were authorized/performed.

## Result

One optional HTTPS-wide setup action enables detection and automatic code finding.
A top-level email-code field triggers bounded recent-mail retrieval without Canva
sender/template filters. Generic English numeric 4–8 digit candidates use explicit
code context, message timing and known field length. Missing maxlength is supported
through candidate-derived prepare/release length. Plain and inert HTML MIME text can
be processed; differing plausible codes/messages refuse. No email links/resources run.

The minimal popup says Code found and offers Fill. A required exact-popup confirmation
precedes bound prepare, write-ahead message reservation and release. Generic matches
are CANDIDATE, never VERIFIED. Account/mailbox/document/origin/focus/field/expiry/block/
permission/available-settings checks remain. Codes, mail, credentials and mappings are
not persisted. Generic local history has null service ID. No extension submission.

[ADR0022](adr/0022-generic-user-confirmed-fill.md) explicitly supersedes the prior
reviewed-only release requirement for this mode. Generic matching cannot prove sender
identity, direct receipt, replay exclusion or email-to-site/challenge association.
The setup disclosure states that Fill shares a likely code with the current page.
Sender/destination details are absent beside Fill as requested.

## Acceptance

| Criterion                                                                       | Result                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unknown HTTPS site, no service mapping or per-site enablement                   | Passed synthetic browser/connected transport tests                                                   |
| One setup action enables automatic finding                                      | Passed isolated Chromium; grant API simulated, no owner grant changed                                |
| No release before Fill; declined/missing confirmation refuses                   | Passed coordinator regressions                                                                       |
| Single/split input events, leading zeros, unknown maxlength                     | Passed synthetic unit/Chromium cases                                                                 |
| Unrelated normalized mail ignored; multiple codes/messages refuse               | Passed generic parser and connected raw Gmail-response simulations                                   |
| Stale, malformed, incomplete/truncated mail refuses                             | Passed parser/transport/policy tests; no live adversarial delivery claimed                           |
| Navigation/account/mailbox/focus/fields/typing/expiry/blocks/replay             | Existing retained regressions passed, plus generic confirmation/navigation/reservation refusal cases |
| Missing broad site permission or unavailable settings prevents activity/release | Passed worker/permission/confirmation regressions                                                    |
| Minimal popup, no sender/destination/code beside Fill                           | Passed browser assertions and synthetic visual inspection                                            |
| Fixture-free production manifest and bundle                                     | Passed five checks on separately configured review artifact                                          |
| Fresh real login across several named websites                                  | Unverified; no real mail/code challenge was initiated in this scope                                  |
| Prior owner-assisted lifecycle/concurrency/privacy matrix                       | Still deferred/unverified; this PR does not close it                                                 |

## Validation

Performed in `/tmp/otpguard-generic-validation` without owner env files or configured
builds. Commands used pinned Bun 1.4.2 via
`PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`.

- `bun install --frozen-lockfile`: passed isolated installation.
- `bun run check`: typecheck, lint and formatting passed; 417 tests in 31 files passed.
- `bun run build`: production extension and web builds passed. Subsequent extension
  rebuilds passed after popup/detector/final current-settings edits.
- `bun run build:mock`: passed, exclusively in the isolated validation export.
- `OTPGuard_ARTIFACT=/tmp/otpguard-generic-owner-review/apps/extension/build/chrome-mv3-prod bun run test:browser`:
  40 passed, one configured Gmail UI simulation skipped because the suite itself is
  provider-free. Production-content cases use the configured review content artifact;
  popup/provider tests use unconfigured or synthetic harnesses. These are not a real
  provider-to-website end-to-end run.
- `OTPGuard_ARTIFACT=... bun node_modules/vitest/vitest.mjs run tests/manifest.test.ts`:
  five configured-artifact checks passed.
- `bun run package:review` and `bun run check:packages`: credential-free ZIP creation
  and extracted standalone web/mobile/assets/MV3 worker/popup smoke passed.
- `git diff --check`: passed.

Final current-settings refusal was additionally regression tested after the full
browser run; its generated worker was rebuilt. The production content script and
popup remained unchanged from that full run. Current exact hashes are recorded in
[artifact provenance](generic-fill-artifact.json).

Initial failures were resolved: default Bun 1.2.22 could not read the pinned lockfile;
local-server sandbox restrictions required permitted execution; browser assertions
referenced old Canva/protection copy. Extracted-package smoke also contained outdated
pre-landing dashboard navigation and collapsed-popup assertions, now corrected without
changing website behavior. A connected test initially omitted the intentionally required
automatic-finding preference; correcting its setup exercised the actual retrieval path.

## Review artifact and owner test

Configured artifact, built separately with existing **public** Clerk/Gmail/Convex
configuration and the same extension ID:
`/tmp/otpguard-generic-owner-review/apps/extension/build/chrome-mv3-prod`.
The current installed extension and named previous builds remain unchanged.
No secret provider env file was copied. Review ZIPs are unconfigured and are separate
from this configured local artifact.

After owner review, update only the combined extension to this artifact, preserving
its ID and legacy installation. Enable on websites once, accept Chrome's HTTPS-wide
permission, then reload a login page. Start one fresh email-code challenge and wait
for Code found. Confirm the field remains empty; click Fill and complete login yourself.
Record success/refusal only, never mail/code screenshots or logs. Repeat on chosen sites
before making coverage claims. For a refusal check, type into the field before Fill
or navigate away; no code should overwrite or reach the replaced page.

## Coverage and remaining limits

No claim of “most sites” acceptance yet. Numeric 4–8 digit English code context,
top-level HTTPS default-port pages and ordinary visible text/tel/password inputs are
supported mechanically. Iframes, shadow roots, SMS/TOTP, alphanumeric codes, password
reset/recovery/financial purposes, unsupported encodings/attachments
and malformed MIME remain unsupported. Broad all-recent-mail bounds can refuse busy
mailboxes; malformed unrelated mail can stop a cycle conservatively. A single recent
code can still belong to another login or be spoofed/imported/replayed. Timing is
field detection time, not the server's actual request time. Site scripts can read the
inserted value and may submit in reaction to input events.

The UI/UX skill search returned no relevant consent-specific guidance; popup changes
used its general accessibility/disclosure defaults and retained the existing visual
system. Synthetic screenshots were inspected locally, without owner data.

Existing acceptance edits in core-implementation-plan.md, website-polish-acceptance.md
and website-auth-live-acceptance.md were preserved. This scope appends its own plan
entry and updates architecture/privacy/threat-model notes. Stop here for owner review.

## Owner-reported Canva / Clerk failures and review repair

The owner reported the configured generic build refusing Canva and remaining idle on
a Clerk email-code challenge. These are failed live acceptance reports, not passing
multi-site acceptance. Screenshots do not establish the exact MIME or DOM cause.

Two deterministic synthetic reproductions exercised the production paths and failed
before repair: the connected retrieval test `encoded-canva` returned UNKNOWN for an
RFC 2047 subject; production content sent no detection for email instructions beyond
three custom-control ancestors. Clerk's public CodeControl/input-otp source informed
the decorative-slot fixture; no owner page values or mail were captured.

Candidate-only MIME normalization now decodes bounded UTF-8/ASCII B/Q encoded subjects,
including adjacent words. Unsupported/malformed encodings and controls still refuse;
the signed pilot normalizer keeps its strict contract. Detector context now searches
up to eight ancestors, excluding body/html and preserving node/text caps. There are
no site-specific selectors or mappings. The nested fixture verifies empty-before-release
and insertion into the real underlying input. No guess-newest or ambiguous-mail bypass
was added. Malformed unrelated mail can still refuse the cycle.

Repair validation in the isolated source export:

- `bun run test -- tests/generic-fill.test.ts`: 36 passed, including the prior failing
  encoded-subject retrieval scenario and malformed/unsafe-subject regressions.
- `bun run check`: typecheck/lint/format and 424 tests in 31 files passed.
- `bun run --filter @otpguard/extension build`: passed provider-free production build.
- Configured repair build with existing public configuration: passed, same extension ID.
- Configured `tests/manifest.test.ts`: five checks passed.
- `OTPGuard_ARTIFACT=/tmp/otpguard-generic-owner-repair/apps/extension/build/chrome-mv3-prod bun run test:browser`: 41 passed, one provider-dependent simulation skipped.
- `git diff --check`: passed. Exact repair hashes are in generic-fill-artifact.json.

Use `/tmp/otpguard-generic-owner-repair/apps/extension/build/chrome-mv3-prod` for owner
retest. Previous review artifact remains unchanged. The agent did not change the
installed extension or permissions. Owner must retest fresh separate Canva and Clerk
challenges before live acceptance can be marked passed; these compatibility fixes
are proven against synthetic reproductions, not asserted as the exact live causes.

## Continued owner failure — specific local blocker reporting

Owner reported the same Canva refusal after repair; latest screenshot also reports
OTPGuard Sign-in needed while Gmail remains connected. Live Canva remains failed,
not accepted. The prior synthetic compatibility fixes did not establish the live cause.

The popup regression reproduced missing account/mailbox/detection blocker headings.
Those states now have explicit recovery text. A signed-out account takes precedence
over stale pipeline failure/READY display and disables Fill; the worker's authoritative
authentication gates remain unchanged. Retrieval records only a volatile enum for
MIME/schema/limit/network/quota/mailbox failures, cleared for each cycle, surfaced in
the popup without message IDs, mail contents, codes, tokens, timestamps or senders.
Ambiguity has separate recovery text. No telemetry/storage or weaker release checks
were added. This is diagnostic/recovery work, not a claim the live failure is fixed.

`bun run check` passed (424 tests); provider-free and separately configured diagnostic
extension builds passed. Popup/Gmail browser suites passed six cases with one
provider-dependent simulation skipped. The exact combined signed-out/stale-UNKNOWN
case is additionally exercised through the actual popup. The connected malformed
mail test asserts the emitted MIME diagnostic; successful requests clear it.

Diagnostic artifact: `/tmp/otpguard-generic-diagnostic/apps/extension/build/chrome-mv3-prod`,
with existing public configuration and the same extension ID. Prior artifacts and
owner installation/permissions remain untouched. Owner clarification about account
sign-in recovery was requested; live root cause remains unresolved pending the actual
account state and specific local failure reason after retry.

## Decoder regression repair after MIME failure confirmation

Owner's next screenshot confirms both accounts connected and the local MIME failure
branch. Canva was reported working before the generic PR. Differential synthetic
test: the old normalizer accepts plain text plus an HTML alternative containing
ordinary `&copy;`/`&mdash;` footer entities; the generic normalizer returned null.
The generic HTML reader's six-entry entity map and blanket leftover-entity rejection
introduced this regression. This is directly reproduced; the owner's exact live
email/entity was not read or captured and live Canva acceptance is still pending.

Use pinned `entities@8.1.0` in the OTP package for standards-based inert HTML text
decoding after markup stripping. No HTML rendering, links, DOM or network fetching.
Numeric invalid references and unsafe controls still refuse. Normal invisible
preheader padding becomes line separators, preventing code fragments from joining.
Unknown references remain literal rather than disappearing. Plain and HTML candidates
still jointly contribute to ambiguity. The signed pilot contract is unchanged.

Connected raw-Gmail simulation additionally caught a footer year followed by
“do not share your code” becoming a false second code; associate inline digits
with the following part of a label or a directly preceding code phrase. Distinct
labeled codes and messages still refuse. No per-site mapping/filter was restored.

`bun run check`: passed 429 tests in 31 files plus typecheck/lint/format. Provider-free
and configured production builds passed. Frozen lockfile installation and five
configured manifest checks passed. Full synthetic browser suite against the current configured artifact: 41 passed,
one provider-dependent simulation skipped. `git diff --check` passed.

Current review artifact: `/tmp/otpguard-generic-mime-repair/apps/extension/build/chrome-mv3-prod`.
Same ID/public configuration; prior artifacts and installed extension untouched.
Owner should retry separate fresh challenges using this artifact. The specific
regressions are fixed in synthetic tests; real multi-site acceptance remains open.

## Canva owner success, Clerk route repair, and broader email coverage

Owner confirmed Canva worked with the MIME repair. Clerk still refused with
PAGE_UNAVAILABLE on its /sign-in/factor-one route. A disposable synthetic Chromium
probe reproduced Chrome preserving the initial sender.url after history.pushState
while current frame/tab URLs changed and document IDs matched. A worker regression
then failed on admission and passes after binding the browser's live frame URL once
sender origin/document ID are verified. Current still requires exact full bound URL,
permission, foreground, settings and document identity. Fragment navigation is now
explicitly cancelled as well. Cross-document/origin mismatch tests refuse. No owner
query parameters, page DOM, mail or tokens were captured or stored. Probe removed.

Owner additionally requested broad email variations. Added generic-only mixed MIME,
inert embedded images/binary application attachment exclusion, subjectless mail,
Windows-1252/ISO-8859-1 decoding, passcode/this-code wording, spaced digits, inline span
and table-digit layouts. No per-site mappings or guessed newest-code selection.
See [coverage matrix](generic-email-coverage.md) for 47 synthetic cases and explicit
unsupported formats. “Every possible email” is not an acceptance claim.

`bun run check` passed: typecheck/lint/format and 477 tests in 32 files. Production
provider-free/configured builds passed. Eleven combined manifest/worker-route checks
passed against the configured artifact. Full synthetic browser suite against the configured artifact: 41 passed, one
provider-dependent simulation skipped. `git diff --check` passed. A final comment-only
source change was rebuilt; runtime behavior is unchanged from the tested artifact.

Current review artifact: `/tmp/otpguard-generic-expanded-review/apps/extension/build/chrome-mv3-prod`.
Same ID/public configuration; owner installation and permissions unchanged. Canva
live success is owner-reported; Clerk live retest remains open after the route fix.

## Continued Clerk MIME refusal — precise decoder-stage diagnostic

Owner's subsequent screenshot confirms page admission advanced to a MIME refusal,
with accounts connected. Clerk remains failed live acceptance. Broad synthetic format
coverage did not establish this live message's decoder branch.

The raw normalizer now optionally reports a fixed stage enum (size/line endings/parts/
headers/duplicate headers/forwarding/disposition/subject/boundary/MIME type/transfer
encoding/charset/text controls/HTML/no text). Retrieval passes this memory-only enum
to the popup, which displays “Email decoding stopped at …”. No message/header value,
code, token, identity, ID, body or timestamp is collected by this diagnostic. The
normalizer's acceptance behavior is unchanged. Successful retrieval cycles reset it.

The diagnostic regression failed before instrumentation; raw-to-retrieval and actual
popup assertions verify the fixed enum. `bun run check` passed 478 tests in 32 files
with typecheck/lint/format, and provider-free/configured builds passed. Focused tests
validate the configured artifact and common formats; popup checks validate display.

Current artifact: `/tmp/otpguard-decoder-diagnostic/apps/extension/build/chrome-mv3-prod`.
Same ID/configuration; owner installations/permissions unchanged. Owner decoder-stage
text is required to identify the live refusal before a targeted semantic repair.
No live fix or Clerk acceptance is claimed.

### Clerk charset refusal — standard encoding labels

Owner screenshot identifies `charset` as the refusing stage; exact live label/bytes
remain unknown. Four synthetic UTF-8 messages reproduce that stage: whitespace
around charset equals, quoted trailing whitespace, utf8, and unicode-1-1-utf-8.
Generic MIME parameter parsing now accepts whitespace and trims the label; decoding
uses standard browser TextDecoder labels with fatal decoding and no guessed fallback.
Explicit ASCII still rejects non-ASCII bytes. The signed pilot remains strict.
Regression cases reject malformed UTF-8, non-ASCII declared ASCII, and unknown labels.
Validation: full check passes (482 tests before three additional rejection cases);
focused extraction/fill suite passes all 96 tests with those rejection cases.
Configured artifact built at the path recorded in generic-fill-artifact.json.
Clerk live success remains unconfirmed. No live mail contents or codes collected.

### Owner-requested reliability revision, blockers 1–7

Scope: isolate strongly unrelated unreadable messages using bounded subject/snippet
relevance heuristics; broaden generic MIME normalization without altering signed
pilot parsing; separate markup and extracted-text limits; improve top-level ordinary
and split input detection; acknowledge retained fills after asynchronous framework
updates; share a bounded challenge window through retrieval/retry and refresh it on
resend; exclude candidates contradicted by receipt/length/explicit recipient hints.
No newest-message tie-break, unverified sender claim, automatic release, iframe,
alphanumeric or language expansion. Relevance/recipient hints remain heuristics,
not authenticated transaction evidence. Real multi-site coverage remains separately
unverified. The existing local generic-fill PR is the review boundary.

Reliability blockers 1–7 are implemented and synthetically accepted under ADR0023.
See generic-reliability-acceptance.md for the per-blocker matrix, 507 test / 46 browser
case results, configured-artifact checks, owner test steps and unverified live boundaries.
The current configured build and hashes are in generic-fill-artifact.json.
