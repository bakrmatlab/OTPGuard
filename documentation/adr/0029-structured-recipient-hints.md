# ADR0029 — Complete structured recipient hints

Status: local rank-5 implementation for owner review, October 5, 2026.

## Problem and evidence

`rawEmailHints` searched To/Cc text for address-shaped substrings. It counted addresses
inside display names/comments and truncated valid local parts such as `person!tag`.
A malformed or unsupported member could leave a partial list that retrieval treated
as an explicit contradiction before MIME decoding. Synthetic connected tests reproduced
FILLED with a hidden competing code; independent coordinator envelopes had the same
unsafe exclusion. Page extraction and runtime schema had the same limited alphabet.

## Decision

Use a bounded, pure RFC 5322 subset parser for visible To/Cc/Bcc fields. Parse whole
mailboxes, address lists and groups; ignore display names and nested comments as address
sources. Support ASCII dot-atom local parts including the full atext alphabet, quoted
local parts and quoted-pairs, angle addresses, folded headers and domain case variants.
Canonicalize equivalent quoted local spelling and domain casing; retain local-part case.

All present recipient fields must parse completely. A malformed/unsupported member,
duplicate field, empty field or undisclosed empty group discards recipient exclusion
evidence for the entire message. No partial recipient list escapes. Missing fields
supply no evidence. Bounds: 8 KiB per list, 100 mailbox entries before deduplication,
eight comment levels, 320-character addr-spec representation, 64-character semantic local part and 253-character ASCII domain,
within the existing raw/header limits. Overflow is uncertainty, never exclusion.

The comparison boundary validates both the page addr-spec and every envelope recipient.
A message can be excluded only when a nonempty complete visible set consists entirely
of explicit differences. Unknown comparisons remain plausible. Exact addresses match;
personal `gmail.com` / existing `googlemail.com` spellings use dot/plus equivalence only
for an understood ASCII letter/digit/dot base. Unusual personal Gmail local parts remain
uncertain when not exactly equal. Custom/Workspace domains retain dots and plus tags.
Non-Gmail local-part case differences alone are uncertain, never exclusion evidence.

Rendered page prose uses a stricter standalone-token reader, preserving rendered block
boundaries and inline fragments. It never scans for a supported suffix inside an
unsupported address. Multiple distinct, malformed, masked or unsupported tokens omit
the hint while still admitting ordinary email-code detection. Page wrappers, punctuation
attached to an address and quoted local parts with spaces are deliberately uncertain.
The closed detection schema accepts only validated bounded addr-specs. The worker
preserves their spelling. Retrieval and coordinator use the same contradiction rule.

## Alternatives and consequences

A broader address regex still cannot distinguish structure or incomplete lists.
Dropping unknown members hides competition; treating malformed addresses as different
has the same problem. Assuming every provider implements Gmail aliases manufactures
identity. None is adopted. A small explicit parser avoids a new dependency, but is
intentionally a subset rather than a universal RFC or mail-delivery validator.

Obsolete route/address syntax, domain literals, internationalized local parts/Unicode
domains, comments within dot atoms and resource overflow are unsupported evidence.
Their mail remains subject to the existing MIME/candidate/refusal rules. A complete
explicit contradiction can still exclude unreadable mail; uncertain recipients cannot
bypass rank-4 decoder refusal. Bcc is considered only when present; visible headers do
not prove the envelope recipient or rule out hidden delivery/forwarding/aliases.
Other provider aliases are compared by literal visible spelling; equivalence is not
inferred and no mapping is stored.

No change to sender/service hints, sender trust, provider query, permissions, persistence,
logging or backend traffic. All parsed hints/mail/code/token material remain local and
transient. Generic offers remain CANDIDATE with mandatory extension-owned Fill, fresh
account/mailbox/browser authority, exact field binding and write-ahead replay refusal.
No newest-code choice, expiry bypass, replay clearing or extension submission. The
60/30/15 phase budgets and rank-4 complete-set/resource bounds are preserved.

## References and verification

[RFC 5322 §§3.2–3.4](https://www.rfc-editor.org/rfc/rfc5322.html) distinguishes
comments, phrases, mailboxes, addr-specs and groups. Google's
[personal Gmail dot rules](https://support.google.com/mail/answer/7436150?hl=en)
explicitly exclude organization domains, and its
[Gmail alias guidance](https://support.google.com/mail/answer/22370?hl=en)
describes plus aliases. These are syntax/provider references, not live acceptance.

See [recipient acceptance](../recipient-parsing-acceptance.md) for red/green tests at
raw, retrieval, coordinator, schema and production browser seams. Late old mail,
same-mailbox concurrent challenges, hidden recipients, forgeable page/header hints and
server transaction identity remain limited. Synthetic Fill does not prove live success
rates or server completion. Cloud history/device sync remain disabled/unconfigured.
