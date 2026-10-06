# Generic email-format coverage

Owner requested broad code-email variations, October 5, 2026. These are synthetic
compatibility cases, not a claim of exhaustive email or website coverage.

| Variation                                                                                  | Current behavior                                                                   |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Plain text / HTML-only                                                                     | Supported with explicit code wording                                               |
| Multipart alternative, related, mixed; nested/folded headers                               | Supported, bounded by existing size/part/depth limits                              |
| 7bit / 8bit / base64 / quoted-printable; wrapped base64                                    | Supported                                                                          |
| UTF-8 / US-ASCII / ISO-8859-1 / Windows-1252 bodies                                        | Supported                                                                          |
| Ordinary, folded B/Q, adjacent and legacy-encoded subjects                                 | Supported; subjectless mail allowed in generic mode                                |
| Login, security, verification, confirmation, one-time password, OTP, passcode, “this code” | Supported English wording                                                          |
| Code in subject, same line, next line, inline spans or table digit cells                   | Supported                                                                          |
| 4–8 digits, leading zeros, space-grouped digits                                            | Supported; exact field length rechecked before release                             |
| HTML named/numeric entities, copyright footers, zero-width preheader padding               | Supported; padding is a separator, never joins fragments                           |
| Inline images and binary application attachments                                           | Ignored as inert resources; never decoded, loaded, opened or used as a code source |
| Distinct plausible codes in plain/HTML or separate messages                                | Refused; no newest-message tie breaker                                             |
| Footer years before code-sharing reminders                                                 | Excluded as a second code                                                          |
| Forwarded/replied/attached email bodies, encrypted bodies                                  | Refused                                                                            |
| Malformed MIME/transfer encoding/boundaries/unsafe controls                                | Refused                                                                            |
| Recovery/reset/payment/SMS/TOTP purposes                                                   | Refused under the current sign-in-only contract                                    |
| Symbols, outside 4–8 characters, non-English-only code wording                             | Unsupported in this PR                                                             |

The 47-case matrix in `tests/generic-email-coverage.test.ts` covers successful formats
and refusal behavior. Existing generic connected tests exercise raw Gmail response,
account/mailbox gates, exact click-bound release, malformed diagnostics, and ambiguity.
Resource ignoring is scoped to generic mode. The historical signed pilot normalizer
keeps its stricter MIME/subject/charset contract. No live mail or codes were captured.

Canva was confirmed working by the owner after the MIME repair. Clerk's independent
page-context refusal was reproduced in Chromium: after pushState, sender.url retains
the original URL while webNavigation/getFrame returns the new URL for the same document.
Admission now validates sender/document/origin, binds the live frame URL, and rechecks
it before release. Later path/query/hash changes cancel/refuse. This applies generally
to SPA login flows, with no site selectors/mappings. Clerk live retest is still pending.

Generic body decoding supports standard TextDecoder charset labels and MIME
parameter spacing, including UTF-8 aliases. Malformed bytes and unknown labels
refuse; no fallback guessing is used. The strict signed pilot is unchanged.

Owner-requested format follow-up supports 4–8 ASCII letters/digits, including
letter-only codes, with exact case preserved and explicit code placement required.
Numeric-only input types/patterns refuse letters before writing. See ADR0024 and
`tests/alphanumeric-otp.test.ts`; historical reviewed automatic policy stays numeric.

Grouped format follow-up: exactly two groups of three ASCII alphanumeric
characters separated by one hyphen are recognized under explicit code-context
gates. The presentation hyphen is omitted from the six-character release. Other
punctuation and longer grouped tokens remain unsupported. Synthetic regression
coverage is in `tests/grouped-alphanumeric-otp.test.ts`.

## Rank-4 bounded retrieval/MIME revision

Generic transfer-encoding tokens accept surrounding whitespace after header unfolding;
plain/HTML alternatives still jointly contribute to ambiguity. Unknown charset labels,
invalid bytes, truncated boundaries, unsupported containers, forwarded/attached text,
encrypted messages and per-message part/depth/text/raw caps continue to refuse.
No text attachment extraction, external-resource fetch, language or code-format expansion.

Generic search now includes spam/trash and follows bounded pagination before fetching
all returned bodies (fifty IDs, five pages per enumeration, four parallel reads).
A closing enumeration refuses visible ID-set changes; caps and unreadable eligible mail
refuse the cycle. Newsletter-looking subjects and short snippets cannot prove the unseen
body lacks a competing code; snippets are no longer requested or used. This supersedes
the earlier unreadable-newsletter exclusion. Readable ordinary mail remains parsable and
excludable under the existing candidate contract. Sent/draft/archive labels are not used
as trust or exclusion evidence; this is a time-only mailbox query, not inbox-only search.

Gmail search/indexing is provider-dependent. Re-enumeration is not an atomic snapshot;
mail indexed after it or arriving during confirmation can still be missed. Over fifty
messages, more than five pages, malformed responses, per-response/aggregate/MIME caps,
quota/offline and timeout failures cannot fall back to a partial or newest-code choice.
Live coverage and late-old-mail/server challenge identity remain unverified/limited.
See [acceptance](retrieval-mime-acceptance.md) and
[ADR0028](adr/0028-bounded-complete-generic-retrieval.md).
