# Generic request routing and admission follow-up

October 5, 2026. Local review only on `codex/generic-request-followup`, based on
`96e072726a0e7b1b94515deee93aa2923d8d2cc4`. Proposed title:
`fix(extension): correct generic email-code selection and request lifecycle`.

## Findings and change

The production background listener forwarded detect/cancel but dropped the existing
content-script challenge event. Consequently the coordinator could not retain the
worker-timestamped email-request gesture when the OTP form appeared later than its
60-second fallback lookback. A regression against the actual listener failed with
`expected false to be true` before the routing correction. A second listener test
completes a Canva-shaped request, timestamps an unfamiliar-site email request, then
waits 90 seconds before detecting its nested code control. Its earlier synthetic
mail remains eligible through the challenge window. No site mapping is involved.

Account/mailbox/page admission ran before the coordinator created any deadline or
cancellable request. The real composed account gate, Gmail lifecycle, transport and
page coordinator reproduced a completed fill followed by an unfamiliar-site request
whose provider check stalled. At 60 seconds the new handle remained unresolved
(`expected undefined to deeply equal { state: 'CANCELLED' }`), with no new Gmail call.
This is an actual pre-retrieval hang, not evidence of recipient rejection.

Admission now has a 60-second deadline measured from detection receipt. Its time is
included in the subsequent request deadline. Navigation, account/mailbox/settings
changes and disposal invalidate pending admission as well as admitted requests.
An optional abort signal travels through the production context wrappers; late
provider results cannot enter retrieval or overwrite context failure after abort.
Non-cancellable SDK/Chrome work may finish internally; no abort capability is claimed
for those APIs. Existing signed-out/mailbox-unavailable behavior is preserved.
Only detect messages reset the searching display; challenge/cancel checks do not
start a new searching display merely to establish context.

The worker uses optional HTTPS-wide permission, `registry=[]`, `serviceId=generic`
and sender-free bounded Gmail queries. The historic Canva strict pilot is separate.
No Clerk/Canva exception, recipient-rule change, permission expansion, mailbox grant
change, storage field, logging, backend payload or popup label change is introduced.
Required Fill confirmation, generic CANDIDATE (never VERIFIED), ambiguity refusal,
account/mailbox/tab/document binding, expiry and replay enforcement remain intact.

## Validation

Pinned Bun: `/tmp/otpguard-runtime/bun-darwin-aarch64/bun` (1.4.2).
Sources exported with `/tmp/otpguard-export.py` to
`/tmp/otpguard-generic-validation`; both new test files copied explicitly because
this local export helper includes only tracked files and its historic extra list.
The root checkout's missing entities dependency is not used for validation.

- `bun run check`: passed type checks, lint, formatting and 524 tests in 35 files.
- New tests: two actual-background-listener cases and nine production-composition
  cases spanning account/mailbox/page stalls, deadline/navigation cancellation,
  late results and successful delayed admission after an earlier completed fill.
- Provider-free build: `bun ../../scripts/build-extension.ts`, with public provider
  environment variables removed, passed in the exported extension directory.
- Configured build: `python3 /tmp/otpguard-generic-request-review-build.py`, using
  existing public configuration and exported locked workspace dependencies, passed.
  Artifact: `/tmp/otpguard-generic-request-review/apps/extension/build/chrome-mv3-prod`.
- `bun run test:browser`: 47 passed, one configured-Gmail simulation skipped
  (48 total), using isolated synthetic Playwright fixtures. The first sandboxed
  attempt could not bind loopback servers (`EPERM`); the approved local test run
  passed. No owner browser/profile or real mailbox was used.
- `git diff --check`: passed. No live browser, real mailbox, email collection,
  provider calls, installation, publishing, merge or deployment performed.

## Acceptance and limits

Achieved: formerly dropped challenge routing; bounded/cancelled admission; no late
retrieval/release after expiry or navigation; sequential unfamiliar-site handling;
existing security and minimal-prompt regressions remain passing.

Unverified: the owner-reported Clerk flow and broad live compatibility. The collapsed
SEARCHING screenshot at two seconds does not identify a failed stage. No actual
Clerk MIME/template or expanded progress trail was available. These two reproduced
production defects are fixed; they are not proof of the cause of that live failure.
Recipient filtering, parser format/language constraints and unknown provider behavior
remain possible independent limitations. No new speculative filter relaxation was made.

Owner-controlled check after review: load the configured artifact, complete the
working flow, then request a code on an unfamiliar HTTPS page. Confirm Code found
and that nothing fills until Fill is clicked. Repeat with navigation while searching
or waiting for Fill; the old request must not insert. If Clerk still fails, the
expanded closed-stage progress trail can distinguish admission, Gmail listing and
selection without collecting mail or codes. Live testing remains with the owner.

Stop for review; no next scope is started.

## Recipient boundary correction after owner review

The owner supplied an expanded closed-stage trail: Gmail listing/fetching completed,
then messages were repeatedly excluded for a recipient mismatch before decoding.
The owner privately confirmed that the Clerk email's displayed To matches the page.
No actual mail, headers or code was collected. The trail does not identify an
individual message, so it still does not prove which email was excluded.

A production-content synthetic browser fixture reproduced a concrete false recipient.
Adjacent block elements containing `to continue to Example` and
`person@fixture.invalid` have concatenated textContent. The content script emitted
`exampleperson@fixture.invalid`, which contradicts matching mail even though the
rendered address is correct. The failing command was:
`bun run test:browser tests/browser/core3.spec.ts -g 'nested email code'` in the
exported checkout. Its assertion showed the expected synthetic address versus the
prefixed synthetic address above. An earlier attempt in the root used its outdated
build and failed detection; that result was discarded, not used as defect evidence.

Recipient extraction now uses rendered innerText after the existing bounded
textContent/masked-address guard. This preserves block boundaries and inline address
fragments while ignoring hidden text. It does not remove recipient filtering or
change mailbox binding, aliases, MIME decoding or numeric/purpose rules.

The browser regression now connects the actual bundled production content to the
production account gate, mailbox lifecycle, Gmail transport and page coordinator,
using only synthetic providers/mail. It verifies both adjacent blocks and an address
split across inline spans, keeps the field empty until the simulated Fill click,
and checks retained insertion. The test runner bundles a test-only production-seam
entry because Playwright's TS loader cannot initialize the existing package re-export
cycle directly. This entry is excluded from production build entrypoints.

Final configured artifact:
`/tmp/otpguard-recipient-boundary-review/apps/extension/build/chrome-mv3-prod`, built
with `python3 /tmp/otpguard-recipient-boundary-review-build.py` and unchanged public
provider configuration. Load this new folder and reload the Clerk page so its content
script also updates; clicking Reload on the extension alone leaves old injected
content in already-open documents. Request a fresh code, then check Code found / Fill.
A live retest remains owner-controlled and unverified until reported.

Final validation after recipient correction: `bun run check` passed types, lint,
formatting and 524 tests; `bun run test:browser` passed 48 synthetic cases with one
configured-Gmail simulation skipped (49 total). Provider-free and configured builds
passed. Production bundles contain none of the synthetic recipient/session/token
harness markers; source-content and bundle SHA-256 hashes are recorded in the
configured artifact’s `review-artifact.json`. No live acceptance is claimed.

## Precise ambiguity refusal after the next owner test

Owner retesting reached decoding/selection but still refused with generic ambiguity,
including after the requested fresh-resend attempt. Those screenshots do not prove
multiple messages, parser ambiguity within one message, or a competing page request;
the old popup text grouped all of them. No success is claimed for Clerk.

The coordinator now reports closed terminal stages for competing messages, multiple
numeric candidates inside one email, competing requests/field groups, and incomplete
retrieval. Classification is derived from the actual refusal inputs after the existing
policy decision; it does not alter candidate selection, bypass ambiguity, introduce a
newest-code tie-break, or emit mail identifiers, contents, counts or codes. The popup
shows that specific refusal instead of asking the owner to finish other requests for
every kind of ambiguity. Main Code found / Fill behavior remains unchanged.

Four regression cases first failed because the final stage was merely selecting or
polling, then passed with the exact refusal stage and no prepare/release calls.
`bun run check` passed type/lint/format checks and 528 tests. Provider-free and configured
builds passed. Popup synthetic verification covers all four exact refusal messages
with Fill disabled. This is a diagnostic correction for the unresolved live failure,
not proof that Clerk now fills.

New configured owner-review artifact:
`/tmp/otpguard-ambiguity-review/apps/extension/build/chrome-mv3-prod`, built by
`python3 /tmp/otpguard-ambiguity-review-build.py`. Load it and reload the login page;
the next attempt's closed refusal text identifies the branch without sharing mail.
No live browser/mail access, publishing, merge or deployment was performed.

## Single-email numeric ambiguity and inline copyright correction

Owner's next screenshot identified `codes-ambiguous`: one eligible email parsed into
multiple distinct numeric candidates. This rules out the other newly distinguished
ambiguity branches for that attempt. It does not identify either numeric value or
its context, and the actual Clerk email/template remains unavailable. The owner was
asked only for a private category (one code plus ordinary numbers, two codes, or one
visible number); no mail or code collection is requested.

Synthetic inspection reproduced a concrete parser defect: an explicit code label
followed by an inline copyright year produced a second numeric candidate. The real
connected retrieval case for `Your verification code is 003719. © 2026 Example`
failed with UNKNOWN instead of FILLED before the correction. Three copyright-marker
variants also failed pure extraction. The command was
`bun run test tests/generic-fill.test.ts` in the exported pinned-runtime checkout.

Generic parsing now removes only explicitly marked copyright years/ranges from
numeric candidate consideration. Arbitrary years/four-digit values are not ignored:
`Your code is 2026` is still a candidate. An additional explicitly labelled code
remains ambiguous, including after copyright text. This is a metadata interpretation
heuristic, not proof of sender or transaction identity. No relaxed multi-code policy,
site-specific template, newest-code selection or automatic code release is introduced.
Signed pilot parsing remains unchanged.

`bun run check` passed types, lint, formatting and 532 tests in 35 files. Provider-free
and configured builds passed. The composed synthetic browser and popup cases were
rerun for the changed parser; their result is recorded below. Prior full browser
validation remains 48 passed/one skipped; it is not described as a new full-suite run.

Owner-review artifact:
`/tmp/otpguard-copyright-review/apps/extension/build/chrome-mv3-prod`, built with
`python3 /tmp/otpguard-copyright-review-build.py`. Live Clerk success remains
unverified. The reproduced inline-copyright defect is fixed; the numeric context of
the owner's ambiguous email has not been confirmed, so this is not declared the
proven cause of the live refusal. No real mail/code/token is inspected, logged or
stored; no publishing, merge, deployment or provider change occurred.

## Owner-supplied visual email and request-audit correction

The owner subsequently supplied a screenshot of the rendered email. Its structure
contains one verification code, a sharing reminder, a request-audit sentence containing
location/date/time metadata, and a copyright footer. The audit sentence begins
“This code was requested from”. No personal code, network address, location, mailbox,
image, or original email content was copied into repository fixtures or logs. Tests
substitute existing synthetic codes, documentation-reserved IP space, Example City,
and generic sender/recipient labels. Raw MIME and alternate bodies remain unseen.

This structure exposed the more direct false candidate: the parser interpreted
“This code” in the request-audit sentence as a code label, then collected its date
year. A synthetic version of the visible structure failed extraction as ambiguous
before the fix. Labels followed by explicit request-audit grammar (requested
from/at/on/by/using, with supported auxiliary verbs) now supply no code context.
Other labels on the same line remain eligible; an additional actual labelled code
still refuses. No site name, sender mapping, specific address or date is required.
The inline-copyright correction remains separately tested.

Plain/multiline and inert-HTML structural regressions pass. A real composed connected
Gmail retrieval regression offers/fills the synthetic code from this structure under
the existing required-confirmation adapter. Two genuinely different labelled codes,
including an additional label within the audit line, remain ambiguous.

Final `bun run check`: all type/lint/format checks and 537 tests passed in 35 files.
`bun run test:browser tests/browser/core3.spec.ts tests/browser/popup.spec.ts`: all
13 synthetic cases passed. The preceding run passed 12 but exposed a test timing race
in checking asynchronous setup persistence; the assertion now polls the same stored
value instead of reading it once immediately. No product behavior was changed for
that race, and the failed run is not counted as passing. Provider-free and configured
production builds passed.

Final artifact for this correction:
`/tmp/otpguard-request-metadata-review/apps/extension/build/chrome-mv3-prod`, built
with `python3 /tmp/otpguard-request-metadata-review-build.py`. The synthetic parser
failure corresponding to the supplied visible structure is fixed; actual raw-MIME
compatibility and live Clerk insertion still require owner retesting. No live browser,
mailbox or provider access, personal-value persistence, publication, merge or deployment
was performed. Load this folder and reload the challenge page before requesting a
fresh code. Stop for review after the owner's result.

## Owner confirmation — October 5, 2026

After receiving the request-metadata corrected build, the owner reported: “ok it worked”.
The reported Clerk email-code filling flow is now owner-confirmed working. This is
owner-controlled live acceptance; the agent did not access the live browser or mailbox.
The recipient-boundary and request-audit parsing corrections remain generic and require
no per-site configuration. This confirmation does not establish broad multi-site,
raw-MIME/template coverage, sender verification or the deferred lifecycle/privacy cases.

Current local scope is ready for owner review with 537 tests and the final 13 affected
synthetic browser cases passing; provider-free/configured builds passed. No commit,
publication, merge or deployment has been performed for this follow-up scope.

## Publication authorization — October 5, 2026

After confirming that Clerk filling worked, the owner explicitly authorized committing,
merging and pushing all changes in this follow-up scope. The integration target is
main; origin/main and local main matched at publication preflight. Existing validation
and owner-controlled live acceptance above apply. No deployment or further feature
scope is authorized by this Git publication request.
