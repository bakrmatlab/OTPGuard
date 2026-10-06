# Letter and mixed OTP acceptance

Owner requested this format extension before moving to reliability rank 3.
Prior parser/detection changes remain preserved in the local branch.

Supported: 4–8 ASCII digits, letters or mixed characters, with exact case and leading
zeros preserved. Letter codes need explicit inline/standalone placement. Numeric
space grouping remains supported; symbol-containing, grouped-letter and longer
codes remain unsupported. Candidate, ambiguity, current-page/account/mailbox
binding and required Fill gates remain active. The historical reviewed automatic
policy stays numeric. Number inputs and incompatible patterns refuse letters
before any writes.

Four synthetic parser/schema cases failed before the implementation. Final checks:

- `bun run check`: type checks, lint, formatting and 585 unit/integration tests pass.
- `bun run test:browser tests/browser/detection-recovery.spec.ts tests/browser/core3.spec.ts tests/browser/popup.spec.ts`: 22 tests pass, including production single/split mixed-code insertion, numeric-only refusal and unchanged popup/control flows.
- Provider-free and configured extension builds pass; no provider calls, live
  mailbox access, permissions changes, publication, merging or deployment occurred.
- `git diff --check` passes. The production artifacts contain no synthetic test markers.

Validation used the pinned Bun 1.4.2 and locked dependencies in the isolated
`/tmp/otpguard-generic-validation` export. Configured local review artifact:
`/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.
Live letter-code site acceptance remains owner-controlled and unverified.
See ADR0024 for the format contract and tradeoffs. Rank 3 remains queued.

## Owner-reported grouped-code follow-up

The owner showed a three-character/hyphen/three-character confirmation email and
six site cells. Synthetic copies use fake values and no personal headers. Before
the fix, six regressions failed: four grouped code variants, inert HTML and genuine
competition. HTML also exposed introductory “Here” being misread as a candidate.

The parser now recognizes exactly two groups of three ASCII alphanumeric characters
under explicit code context and releases the six characters with case preserved.
Grouped/ungrouped identical copies are one candidate. Distinct values remain
ambiguous. Introductory Here/This/That before “is your … code” are not candidates.
Arbitrary punctuation, longer groups and URLs remain unsupported. No site-specific
mapping or magic-link action was added.

Final follow-up validation: `bun run check` passes all checks and 599 tests.
The same targeted browser command above passes 23 tests, including the actual
production content filling a fixture with two groups of three boxes from a parsed
fake grouped email, with no value before release. Provider-free and configured
builds pass; `git diff --check` passes. Live owner acceptance remains unverified.
The configured review folder above is rebuilt with the follow-up fix. Reload it and
request a fresh code for live acceptance; older email codes may have expired.
