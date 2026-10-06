# ADR 0024 — Letters and mixed codes in generic user-confirmed mode

Date: October 5, 2026. Status: implemented locally at the owner's request.

## Context

The owner requested codes containing letters before continuing the reliability
queue. Extraction, generic policy, release validation and insertion each previously
required digits, so a parser-only change could not provide a working fill.

## Decision

Support 4–8 ASCII alphanumeric characters, including letter-only codes, preserving
case and leading zeros. Keep the existing length budget. Symbols, grouped letter
runs and longer codes are unsupported. Numeric grouping remains supported.
Letter-containing candidates require clear placement after an explicit code label,
before an “is your … code” label, or on a standalone nearby code line. Single-character
HTML cells can compose a bounded code. Ordinary prose is not tokenized into candidates.
Known unsupported purposes, quoted mail, ambiguity and distinct MIME alternatives
retain their refusal behavior. Generic results remain CANDIDATE with required Fill.
The reviewed automatic numeric policy is not broadened by this change.

Insertion accepts letters only where the field's type and HTML pattern permit
that exact value. Pattern evaluation uses browser Unicode-sets semantics, bounded
pattern length and conservative refusal on invalid patterns. Check before writing
and after page events; do not truncate, uppercase, lowercase, remove symbols or
retry incompatible values. Inputmode alone is a keyboard hint, not validation.

## Alternatives and consequences

Accepting every word near a label would confuse instructions and codes. Free-form
symbols/lengths would require a separate format and field compatibility contract.
Keeping numeric-only gates would fail otherwise eligible email-code flows.
Precise placement sacrifices some template coverage to avoid word guesses. Case
variants are distinct candidates; duplicates with exactly identical spelling remain
one candidate. This does not establish a sender/destination relationship.

## Verification

Synthetic extraction and production release-schema cases first failed for letters
and mixed codes. Tests exercise case preservation, click-bound composed release,
prose/symbol/long-token refusal, mixed-format ambiguity and production single/split
insertion with numeric-only type/pattern refusal. No live mailbox or codes were used.

## Grouped presentation follow-up

The owner's next report showed a three-character/hyphen/three-character email code
and six site fields. Synthetic reproduction confirmed rejection of that format;
it also exposed “Here is your confirmation code” being misread as the word “Here”.

Generic parsing now recognizes exactly two ASCII alphanumeric groups of three
separated by one ASCII hyphen under the same explicit code-context gates. That
hyphen is presentation grouping: produce six characters for release, preserving
case. Do not remove arbitrary symbols or accept longer/grouped token fragments.
Exact grouped/ungrouped copies deduplicate; distinct values remain ambiguous.
“Here”, “This” and “That” before “is your … code” are introductory wording, not
candidates. No per-site mapping, magic-link click, live code fixture or retrieval
policy change is introduced. Other symbol-containing formats remain unsupported.

## Systematic coverage follow-up

The owner requested format families to be covered together. A generated matrix
exercises character-position classes, literal ASCII character coverage, lengths,
English label casing, punctuation, quoted/standalone/subject/MIME placement,
grouping, ambiguity and malformed-token refusal. See the matrix acceptance report.
This exposed uppercase connector failures, punctuation after numeric grouping,
introductory/status-word false candidates and partial numeric token extraction.
Connector grammar now ignores wording casing while code casing remains exact.
Quoted alphabetic candidates require matching wrappers. Numeric token boundaries
reject Unicode-attached word/domain/URL/address fragments. Unquoted lexical
introductory/status words are ambiguous prose and refuse; quoted/isolated code
values remain eligible. This trades uncertain alphabetic word-code coverage for
conservative selection and does not claim arbitrary-language understanding.
