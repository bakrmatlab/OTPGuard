# Connected Gmail feasibility

Research date: October 4, 2026. Scope: an owner-controlled portfolio demonstration on
selected real HTTPS sites. No live mailbox, provider configuration, or code was accessed.
This note proposes options; it does not amend the existing security contract.

## What the provider proves

Gmail supports obtaining a message as base64url RFC 2822 bytes through `format=RAW`.
Its `internalDate` represents Google acceptance time for ordinary SMTP mail, but migrated
mail may instead use a client-selected message date. The documented message resource has
no authenticated delivery-kind field distinguishing original SMTP receipt from import.
Therefore raw messages support independent signature checks, but `internalDate` alone
does not establish the repository's required receipt provenance.
[Google message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages).

`Authentication-Results` is usable only within an established administrative trust
boundary. Matching `mx.google.com`, selecting the first header, or seeing `dkim=pass`
does not itself establish that boundary. RFC 8601 explicitly discusses forged headers,
removal of untrusted results, and position-related attacks. The API documentation above
does not supply a guarantee covering those distinctions for arbitrary stored messages.
[RFC 8601 sections 1.2, 5 and 7](https://www.rfc-editor.org/rfc/rfc8601.html).

DKIM authenticates signing-domain responsibility and integrity of selected headers and
the canonicalized body. Verification must retain original bytes, implement the declared
canonicalization, handle repeated signed headers correctly, and fetch the selector key.
Rejecting `l=` prevents partially signed bodies from becoming a source of appended codes.
DKIM timestamps are optional; a valid signature is not proof of SMTP receipt or the
current website challenge. An intact signed message can be replayed or forwarded.
[RFC 6376 sections 3.4–3.7, 6 and 8.6](https://www.rfc-editor.org/rfc/rfc6376.html).
Use SHA-256; RSA keys below 1024 bits and `rsa-sha1` are unacceptable under the update.
A stricter portfolio policy may require 2048-bit keys, at the cost of coverage.
[RFC 8301](https://www.rfc-editor.org/rfc/rfc8301.html).

## Concrete browser implementation candidates

The MIT-licensed **Thunderbird DKIM Verifier** contains an ESM verifier and browser
cryptographic adapter. Its RSA path uses `crypto.subtle.importKey` with SPKI and
`RSASSA-PKCS1-v1_5`, then `crypto.subtle.verify`; hashing uses `crypto.subtle.digest`.
This demonstrates a working local browser primitive implementation rather than requiring
server-side processing. The Ed25519 path currently uses bundled TweetNaCl.
[Project](https://github.com/lieser/dkim_verifier),
[crypto source](https://raw.githubusercontent.com/lieser/dkim_verifier/master/modules/dkim/crypto.mjs.js).

It is **not an accepted drop-in Chrome library**. The verifier imports preferences,
logging and key storage, and its source explicitly lists unsupported local-part syntax,
missing multiple-key-record rejection, and missing key-version ordering checks.
Porting requires isolating dependencies, disabling persistent mail/result logging,
replacing Thunderbird key resolution, reviewing its defaults and enforcing a stricter
adapter. Its source exposes signing domain, timestamps, signed headers and key length,
which are useful policy inputs. Pin a reviewed revision and preserve license notices;
no revision has been vendored or tested here.
[Verifier source](https://raw.githubusercontent.com/lieser/dkim_verifier/master/modules/dkim/verifier.mjs.js).

**mailauth** is a useful independent test oracle, not a browser dependency: its verifier
imports Node Buffer/crypto and other Node-oriented modules. Compare synthetic canonicalized
messages and failure cases against its strict verifier in development only.
[Project](https://github.com/postalsys/mailauth),
[verifier source](https://raw.githubusercontent.com/postalsys/mailauth/master/lib/dkim/dkim-verifier.js).
Web Crypto supplies the actual cryptographic primitive; it does not supply RFC 5322 parsing,
DKIM canonicalization, DNS key interpretation or authorization policy.
[W3C Web Crypto specification](https://www.w3.org/TR/webcrypto/).

Google Public DNS offers HTTPS TXT queries and a DNSSEC validation indicator `AD`.
An exact resolver host would require additional extension permission/CSP and a documented
privacy disclosure: resolver queries reveal signing domain/selector, not mail bodies or
codes. Reject truncation, errors, malformed/multiple keys, excessive aliases and oversized
responses. Setting `CD=false` requests validation, but `AD=false` must not be described as
DNSSEC authentication. Requiring `AD=true` limits support to signed DNS delegations;
accepting ordinary HTTPS resolver answers explicitly trusts that resolver and unsigned DNS.
[Google DoH JSON API](https://developers.google.com/speed/public-dns/docs/doh/json).

## Proposed portfolio architecture and decisions

The following are engineering proposals, not provider guarantees or approved design changes:

1. Obtain bounded raw bytes in the background worker; independently verify a supported
   signature before MIME/template extraction. Never reconstruct a signature input from
   parsed `format=FULL` fields. Reject unknown algorithms/canonicalization, malformed tags,
   partial-body signatures, duplicate security-critical headers and unsupported MIME.
2. Require an explicit reviewed signing-domain/sender relationship, signed From, To,
   Subject, Date and MIME interpretation headers when present. Require a signed recipient
   exactly matching the connected test mailbox; aliases/Bcc remain unsupported initially.
   A generic provider signing domain must not automatically authorize a service.
3. Require a recent signature `t=` within the request window, a sane signed Date, and
   unexpired `x=` when supplied. Combine these with Gmail metadata only as additional
   selection signals. Services lacking those features remain unsupported under this option.
4. Bind authorization to the current foreground document and exact supported origin.
   Refuse multiple plausible challenges. Deduplicate Gmail IDs and signed-message identity
   locally without retaining code/body; an ID alone cannot detect a separately imported copy.
   Any fingerprint requires an explicit privacy review and bounded retention.
5. Demonstrate altered body/signature, forged authentication headers, stale signatures,
   unsigned recipient, replay, duplicate headers, DNS failure and navigation/account change
   refusals with synthetic cryptographically signed fixtures. Sanitized real fixtures cannot
   retain their original signature validity after replacing the code or recipient.

**Decision needed:** retaining the current trusted-SMTP-receipt requirement leaves real
autofill blocked with the documented API. A reasonable narrower portfolio contract could
accept independently authenticated sender/content plus signed freshness and recipient
binding, while explicitly acknowledging same-window replay/forward/import ambiguity.
That adjustment needs an ADR and revised evidence types/UI; it must not manufacture a
`trustedReceipt` value. A trusted receiving service is another option, but sending full
mail or OTPs to it conflicts with the existing local-only invariant.

Actual service compatibility, signing practices, key policy, templates and inputs remain
unverified until the owner supplies selected sites and runs controlled test-account flows.
