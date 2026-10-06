# Systematic OTP format coverage

Owner requested coverage across format combinations after several parser failures.
This extends the same local format review scope; reliability rank 3 remains queued.

## Generated matrix

`tests/otp-format-matrix.test.ts` runs 34,775 successful extraction/schema scenarios
plus negative cases. They are generated inputs inside 31 test groups, not 34,775
separate Vitest tests or live login attempts.

| Dimension                   | Coverage                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character family and length | Every upper/lower/digit position pattern using representative characters at lengths 4–8: 9,801 patterns, each in three placements                                            |
| Literal character coverage  | Every one of the 62 ASCII letters/digits in every position at every supported length                                                                                         |
| English wording             | Ten supported label families in uppercase/lowercase with seven separator/line-ending styles and four code families                                                           |
| Hyphen presentation         | All 729 upper/lower/digit position patterns at six characters, with 3–3 grouping, ungrouped duplicates, punctuation and standalone placement                                 |
| Numeric space grouping      | Every partition of lengths 4–8 with spaces, tabs and nonbreaking spaces                                                                                                      |
| Formatting                  | Quoted values, normal expiry wording, subject/body placement, inert HTML text/table cells, plain text and base64                                                             |
| Refusal                     | Prose/status words, quoted replies, unsupported purposes, distinct codes and case variants, symbols, overlong tokens, URLs, address-like text and Unicode-attached fragments |

The actual production content script additionally fills numeric, alphabetic and
mixed codes at each supported length in single and split native fields: 30 cases
inside ten browser test groups. Existing number-input/pattern incompatibility,
user typing/replacement, account/document binding, click-required release and
popup keyboard cases remain in regression coverage.

## Repairs exposed by the matrix

Initial matrix failures reproduced case-sensitive “IS” handling, numeric 3–3 values
followed by sentence punctuation, introductory words misread as codes, and quoted
mixed values. Follow-up negative generation caught numeric fragments from tokens
such as `0000/bad` and status prose such as “Your code is valid.”.

Code-label connector grammar now ignores casing while preserving code casing.
Quotes require a matched wrapper for letter extraction. Numeric extraction rejects
attached Unicode letters/numbers and URL/address-like delimiters or domain fragments.
Unquoted introductory/status words are refused; explicitly quoted/isolated values
remain eligible. No arbitrary punctuation stripping or per-site exceptions were added.

## Validation and limits

`bun run check` passes type checks, lint, formatting and **630 unit/integration tests**.
The targeted browser suite passes **33 tests**, including all ten new field groups.
Provider-free and configured builds succeed. `git diff --check` passes.
Validation used pinned Bun 1.4.2 and locked dependencies in the isolated source export.
Configured review artifact: `/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.

The representative class matrix is exhaustive for those three position classes,
not every literal string in the 62-character alphabet. Literal character coverage
is tested separately. This is a bounded compatibility contract, not a guarantee
for arbitrary email languages, formats or live provider behavior. English wording,
4–8 ASCII alphanumeric characters, numeric space grouping and exact 3–3 hyphen
presentation are supported; other symbols/groups, longer codes, frames/shadow roots,
unsupported purposes and genuinely ambiguous requests still refuse. A status word
used without quotation/isolation is intentionally uncertain even if a provider
could use it as a real alphabetic code. Unknown natural language remains heuristic.
No live email/code/token was stored, no live browser/provider access occurred and
no publication, merging or deployment was performed. Live success rates remain
unmeasured; no claim that every future message or a 99% live rate is proven.
