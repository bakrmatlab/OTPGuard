# Parser reliability — first ranked fix scope

October 5, 2026. Proposed title:
`fix(otp): isolate code context from metadata and safety disclaimers`.
Local branch `codex/generic-parser-reliability`, based on merged `09488b5`.
Owner requested all ranked fixes; this is the first independently reviewable scope
under AGENTS.md/HANDOFF.md. Remaining work is tracked in
[the reliability plan](reliability-improvement-plan.md).

## Problem and resulting behavior

The generic parser collected numbers after a code label even when text flattening
put request metadata on the same line. Its two-line context could also cross a
reference heading onto a reference number. A number-free safety disclaimer mentioning
reset was treated as the email's purpose and prevented offering a legitimate login
code. These are reproduced defects, not inferred live failure counts.

Generic parsing now splits at explicit request-audit/reference boundaries, including
when adjacent to the code clause. A metadata boundary stops backward label lookup
for standalone numbers and digit-cell groups. Later actual code labels in the same
metadata statement remain eligible, preserving genuine ambiguity. Ordinary punctuation
is not a reason to drop additional numbers: `Your code is 003719. Or 008417.` still
refuses. A regression caught that risk during implementation and the splitter was
narrowed before completion.

Clearly negated `we [will] never ask/request` statements may be ignored only when
number-free. A disclaimer containing numeric evidence remains in conservative checks.
Other unsupported-purpose wording still refuses; quoted/forwarded evidence remains
checked before normalization. This is deliberately bounded English semantic coverage,
not a general-purpose language understanding or sender-verification claim.

Only `packages/otp/generic.ts` changes production behavior. The signed parser,
permissions, mailbox/account/document binding, required Fill click, replay policy,
UI labels and backend/storage/logging contracts are unchanged. Generic results remain
CANDIDATE, never VERIFIED. No per-site exception or newest-code tie-break is introduced.

## Regression evidence

The synthetic corpus covers inline and separate-line safety disclaimers, flattened
audit text, same-line/adjacent/nested-line request references, true multi-code cases,
unsupported purposes and conflicting MIME alternatives. Six composed cases use the
actual account gate, Gmail lifecycle, transport, normalizer and page coordinator.
They prove no prepare/release occurs before the simulated Fill click, then verify
bound synthetic release.

`bun run test tests/generic-parser-reliability.test.ts` failed ten assertions against
the baseline parser, including the real composed retrieval cases, and passed after
the fix. The initial fixture was corrected to serialize standard CRLF MIME lines;
the corrected fixture was rerun against the baseline and still failed ten assertions.
The final suite has 19 new tests. Fixtures use only synthetic identifiers, mail and
codes; no owner email, address, location or code was collected.

## Validation

Pinned Bun 1.4.2: `/tmp/otpguard-runtime/bun-darwin-aarch64/bun`.
Sources exported by `/tmp/otpguard-export.py` to `/tmp/otpguard-generic-validation`;
the new untracked test file is copied explicitly. Locked exported dependencies avoid
the root checkout's missing entities dependency. Existing test harness files remain
available in that validation directory.

- `bun run check`: passed type checks, lint, format and 556 tests in 36 files.
- Provider-free `bun ../../scripts/build-extension.ts`: passed in the exported
  extension directory with provider configuration environment variables removed.
- `python3 /tmp/otpguard-parser-reliability-review-build.py`: configured build passed
  using unchanged existing public configuration and locked workspace dependencies.
- `bun run test:browser tests/browser/core3.spec.ts tests/browser/popup.spec.ts`: all
  13 affected synthetic browser cases passed; no skipped cases in this run.
- `git diff --check`: passed.

Configured artifact:
`/tmp/otpguard-parser-reliability-review/apps/extension/build/chrome-mv3-prod`.
No installation, provider grant, live browser/mailbox test, publication, merge or
deployment was performed. No live acceptance or 99% coverage claim is made.

## Review acceptance

Achieved: the six corpus variations produce one intended synthetic candidate; actual
retrieval offers required confirmation; genuine numeric competition, conflicting
alternatives and unsupported purposes refuse; current existing tests remain passing.
Unverified: broad live compatibility, unusual disclaimer grammar and the measured
failure distribution. Numeric disclaimers and unrecognized metadata remain conservative.

Owner check, if desired after review: load the configured artifact, reload the login
page, request a fresh code and confirm the field remains empty until Fill. Report
filling and site acceptance separately. Live testing remains with the owner.

The next ranked scope is detection/manual recovery. It remains queued for review;
no second feature scope has been started.
