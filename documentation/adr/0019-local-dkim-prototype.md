# ADR 0019: Isolated local DKIM content-authentication prototype

Date: October 4, 2026. Status: owner selected the local prototype route after
ADR0018; implementation proposed for review. Production activation remains disabled.

## Problem and selected scope

The owner asked whether Core 3 could start. After explaining that the receipt gate
was unresolved and proposing local DKIM with explicit receipt/replay limits, the
owner said to proceed. This authorizes the prerequisite prototype and a revised
pilot trust proposal, not a fabricated service mapping or immediate Core 3 release.
Work stays on the existing Core 2 branch and preserves its evidence documents.

## Revised pilot contract

For this prototype, the claim is **approved signer and covered content integrity**,
not authenticated direct receipt. A trusted key bound to an exact approved signing
domain/selector verifies the original raw bytes. An explicit reviewed rule binds
that signer to the exact From address and one signed To recipient. A signed DKIM
timestamp is bounded to at most five minutes; it is signer-provided freshness,
not provider receipt or the website's current server-side transaction.

The result says `content-authenticated`, `receipt: unverified`, `replay: unresolved`.
It is deliberately incompatible with production `SenderEvidence` and does not
produce VERIFIED, a code, an origin authorization or a direct-delivery assertion.
No real service rules exist. Before a production proposal, define a separate
signer/content evidence type and review the policy without inventing `delivery: direct`.

A recent intact signed copy can authenticate again. Imported or unmarked forwarded
copies may be indistinguishable from the original signed bytes. Recipient binding
and signature age reduce some cases but cannot establish an SMTP envelope recipient,
direct delivery, new challenge or first use. Dedup only covers observed messages;
restart handling must refuse uncertain release and cannot eliminate unseen replay.
The existing parser rejects recognizable quote/forward/attachment structures, but
those heuristics cannot establish absence of forwarding. These are explicit limits
of the proposed narrower pilot, not bugs fixed by accepting DKIM.

## Implementation

`development/dkim/verify.ts` uses browser Web Crypto RSA-SHA256 with 2048–4096 bit
keys. No crypto dependency, Node primitive or mail parsing library enters production.
The development-only verifier implements a deliberately strict RFC6376 subset:
ASCII CRLF headers, bounded raw bytes/headers/lines, one eligible approved signature among at most four total, simple/relaxed
canonicalization, full-body hash (all `l=` signatures refuse), exact mappings,
signed freshness/expiration and signed security-relevant singleton headers.
From/To mailbox syntax is intentionally narrow. Present MIME interpretation headers,
Sender/Reply-To/Cc must be signed and nonduplicated. Missing required signed
From/To/Subject/Date/Message-ID refuses. Unrelated delivery signatures are ignored without additional key queries. Duplicate eligible signatures, Ed25519, SHA-1,
unsupported key flags/algorithms, weak/revoked/conflicting keys refuse.

The verifier snapshots raw input before awaiting and retains no persistent state.
Only closed enums leave it; exception details, headers, addresses and body stay out
of results. A result cannot be transplanted into production as an attestation:
a future adapter must bind parsing and verification to the same owned raw bytes.

An injected trusted resolver receives one fixed approved selector/domain query,
with a two-second abort/deadline and a single TXT record capped at 8 KiB. No live
resolver, DNS endpoint, Gmail reader or new extension permission is implemented.
Resolver authenticity and cooperation with cancellation are caller obligations;
HTTPS DNS would trust the selected resolver and expose query timing, and would
need a reviewed adapter/permission/privacy change. A test-supplied key proves only
mechanics, not service ownership or public DNS authenticity.

## Evidence, alternatives and limits

The protocol basis is [RFC6376](https://www.rfc-editor.org/rfc/rfc6376.html), especially
sections 3.4–3.7, 5.4, 6.1 and 8.6; modern RSA/hash requirements are in
[RFC8301](https://www.rfc-editor.org/rfc/rfc8301.html). The proposed 2048-bit floor
is stricter than that RFC's minimum. [ADR0018](0018-core-2-mail-trust-feasibility.md)
retains provider attestation and service-issued transaction proof alternatives.
A Node mailauth verifier was considered from its
[first-party documentation](https://github.com/postalsys/mailauth); its Node runtime
and general mail-auth scope do not fit this small browser feasibility question.
No claim of equivalent coverage or full RFC compliance is made. This new subset
requires independent vectors/review or replacement with a vetted browser verifier
before production; unsupported real signatures must not cause a policy downgrade.

Node/OpenSSL independently signs fabricated fixtures. Tests cover tampering,
leading-zero/non-ASCII body content, header/body canonicalization, duplicate fields,
unsafe tags, key handling, timeout, snapshot integrity and preserved-copy replay.
Actual Chromium Web Crypto verifies synthetic content and refuses modified bytes.
This proves browser feasibility for the subset, not live OpenAI signing/template
compatibility. No real message or code was collected and no owner session was changed.

## Consequences and next acceptance gates

Production UNKNOWN, unverified receipt, empty registry, zero content entry and
permissions remain unchanged. The isolated controlled production build excludes
the prototype. No deployment, merge or push is authorized by this work.

Before Core 3: privately validate a genuine owner-requested message and challenge
page; establish signer/selector/recipient coverage, template extraction equality,
exact origins and field events; assess signature age/timestamp availability and
real MIME compatibility. Review the revised pilot contract and residual replay
risk against that evidence, validate the resolver and verifier independently, and
specify crash/dedup handling. A sanitized template cannot prove the original DKIM
signature. If a real message lacks required coverage, it stays unsupported.

See [prototype acceptance](../core-2-dkim-prototype-acceptance.md) for checks.
