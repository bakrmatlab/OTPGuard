# Core 2 sender and receipt evidence research

Researched October 4, 2026. Scope: public primary sources and repository code only.
No mailbox, personal email, credentials, live challenge or provider experiment was
accessed. This is a feasibility finding, not acceptance of a real service.

## Finding

The current fail-closed result in `packages/security/gmail.ts` is defensible. The
reviewed public Gmail API contract does not establish the receiver provenance
required by design section 5. A local DKIM verifier could independently establish
signed content and a signing domain, but would not establish direct SMTP delivery
or exclude imported, forwarded or replayed copies. Those are separate claims.

This is a conclusion from the documented contracts below, not a claim that Google
cannot supply a stronger contract or that every Gmail message lacks trustworthy
authentication. Real-mail release must remain disabled under the current design
until a suitable evidence boundary is established.

## What Gmail documents

The Message resource exposes message and thread IDs, labels, snippet, history ID,
internalDate, MIME payload, raw message and Workspace classification labels. The
reviewed schema has no documented structured sender-authentication verdict or
SMTP-versus-import delivery-source field. Headers are ordinary name/value pairs.
Raw format returns the entire RFC-formatted message. For normal SMTP mail,
internalDate is Google's original acceptance time; migrated mail can instead use
the Date header. These statements do not identify which delivery path a returned
message used. [Gmail Message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages)

Insert resembles IMAP APPEND and bypasses most scanning and classification.
Import performs delivery scanning/classification similar to SMTP. Neither method
description promises a consumer-visible authentication attestation. The existence
of insertion paths matters even though OTPGuard itself requests only readonly:
another authorized client can create mailbox messages.
[Insert](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/insert),
[Import](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/import)

The internal-date source enum permits current Gmail receipt time or a valid Date
header. Therefore a recently imported copy can look fresh; fresh internalDate alone
does not prove a new service-generated challenge.
[InternalDateSource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/InternalDateSource)

Google's help page explains Gmail's mailed-by/signed-by display and SPF/DKIM/ARC.
It does not specify an API rule for distinguishing Google's Authentication-Results
from supplied headers across insert/import paths. UI evidence can corroborate a
controlled experiment; it is not the missing API contract.
[Gmail authentication help](https://support.google.com/mail/answer/180707?hl=en)

## Why pass strings and header order are insufficient

Authentication-Results is an assertion whose validity depends on a trusted
producer and transport boundary. RFC 8601 requires consumers to know that the
producer adds valid results and removes foreign results masquerading as local
ones. Matching an authserv-id does not establish that relationship. A topmost
header, Received chain or string containing dkim=pass cannot replace the missing
boundary. A bounded forged-header experiment can disprove a proposed rule, but
passing examples alone cannot establish a universal provider guarantee.
[RFC 8601 sections 1.1–1.2 and 5](https://www.rfc-editor.org/rfc/rfc8601.html#section-5)

ARC signatures are also not a trust policy. Their interpretation requires deciding
which intermediaries are trusted; the protocol explicitly excludes providing a
trust framework. Accepting any valid ARC chain would not justify the initial
direct-mail-only product contract.
[RFC 8617 Appendix A.2](https://www.rfc-editor.org/rfc/rfc8617.html#appendix-A.2)

## Local DKIM: useful, but a different boundary

DKIM verifies responsibility by a signing domain using a DNS public key. It does
not equate that domain with the purported author. A verifier must operate on raw
bytes, perform specified canonicalization, verify selected headers and body hash,
and handle duplicate headers correctly. A signature can exclude a body suffix
through l=, so OTPGuard should reject l= entirely. Successful verification does
not identify the delivery path; signatures can survive relay transit. Changing
signed fixture bytes invalidates their original signatures.
[RFC 6376 sections 1, 3.4–3.7, 5.4 and 6.1](https://www.rfc-editor.org/rfc/rfc6376.html)

Policy would reject SHA-1 and undersized RSA keys. RSA-SHA256 is the baseline;
Ed25519-SHA256 is a standardized alternative requiring deliberate implementation
and test coverage, rather than accepting every declared algorithm.
[RFC 8301](https://www.rfc-editor.org/rfc/rfc8301.html),
[RFC 8463](https://www.rfc-editor.org/rfc/rfc8463.html)

Signed-message replay is a documented threat. DKIM operates on message content,
not SMTP envelope recipients. An authentic message can be reintroduced without
forging its signature. Current receipt time and a new Gmail ID consequently do not
eliminate replay. Recipient binding, signed freshness and local deduplication can
reduce some cases but cannot establish the website's current server-side challenge.
[RFC 4686 sections 1.1 and 4.1.4–4.1.5](https://www.rfc-editor.org/rfc/rfc4686.html#section-4.1.5)

DNS creates both integrity and privacy considerations: attacker-chosen selectors
can cause key lookups that reveal verification timing. A verifier should restrict
approved signing domains and bound selectors, lookup count, response size and
timeouts before querying. This is proposed OTPGuard policy, not an existing feature.
[RFC 6376 sections 8.5 and 8.10](https://www.rfc-editor.org/rfc/rfc6376.html#section-8.10)

Browser-compatible DNS-over-HTTPS can retrieve TXT records, but it adds a resolver
and network destination that must be documented. HTTPS protects the resolver
transport; it does not independently turn every answer into DNSSEC-authenticated
evidence. The resolver sees the query. Never send message bytes or OTPs to it.
[Google Public DNS DoH](https://developers.google.com/speed/public-dns/docs/doh)

## Concrete owner-selectable routes

These are engineering alternatives inferred from the evidence, not authorized
design changes or implemented capabilities.

| Route                                                                  | What it enables                                                                                                                     | Remaining issue                                                                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obtain a provider-supported receiver contract                          | Preserve current design if it distinguishes authenticated direct receipt from import/forwarding and supports adversarial validation | No such contract was found in the reviewed public Message API docs                                                                                                          |
| Adopt local raw-message DKIM with a narrowly revised contract          | Verify approved signer/content without trusting Authentication-Results                                                              | Must explicitly accept or independently address delivery provenance, replay, signed freshness and recipient binding; requires design/ADR approval and real service fixtures |
| Use a controlled receiving boundary or service-issued signed challenge | Establish explicit receipt or transaction attestation                                                                               | New architecture/provider integration; an OTPGuard mail-processing server would violate the current local-only privacy contract                                             |
| Keep extension advisory until stronger evidence exists                 | Preserve current privacy/security contract and allow ordinary user login outside OTPGuard                                           | No real automatic or verified manual fill from UNKNOWN mail                                                                                                                 |

Local DKIM is a credible research prototype, not a drop-in implementation of
`assessGmailSender`. An exact approved signer-to-service mapping must be demonstrated
for the selected service, including third-party delivery domains; broad mailbox-provider
signing domains cannot by themselves authenticate a particular service. A synthetic
DKIM fixture can test verifier mechanics, but cannot certify a sanitized real
template's sender or original signature.

## Required evidence before any trust decision changes

1. Select and exercise a genuine owner-controlled email-code flow, recording exact
   destination origin, sender mapping, template, signed fields and freshness policy.
2. Privately validate the original bytes; retain only sanitized outcomes and
   separately labeled synthetic cryptographic fixtures in the repository.
3. Test forged/duplicate Authentication-Results, spoofed From, altered signed body,
   unsigned suffixes, duplicate headers and unapproved signer domains.
4. Test raw forwarded copies, attached/quoted mail, imported copies, signed replay,
   wrong recipient, stale signatures and competing challenges.
5. Distinguish a negative experimental result from a provider guarantee. Record an
   approved evidence contract before allowing VERIFIED; any unresolved case remains
   UNKNOWN under the current contract.

No live experiments or real service validation were completed by this research.
The public documentation finding is complete within this scope; full Core 2
acceptance remains dependent on the selected route and evidence.
