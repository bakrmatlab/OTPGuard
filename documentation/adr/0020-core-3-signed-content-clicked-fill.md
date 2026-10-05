# ADR0020 — Signed-content pilot with extension-owned, user-clicked fill

Date: October 4, 2026. Scope: owner-authorized Core 3, local review only.

The owner selected signer/content authentication with explicit direct-receipt and
replay limitations, Canva first, and one reusable engine. This supersedes the Core 2
prototype-only activation boundary for this controlled pilot. It does not establish
trusted SMTP direct receipt or public-release readiness.

Use Gmail API `format=raw` bytes and the shared Web Crypto DKIM verifier. Require
one eligible signature among at most four, exact signer/selector/From/To, covered
security-relevant headers, full signed body, RSA-SHA256 and 2048–4096-bit key, and
signed freshness at most five minutes. Additional unrelated signatures do not grant
trust. Authentication-Results and Gmail rendered originals never grant authority.
Both signed time and Gmail internalDate must satisfy the request window; internalDate
is an auxiliary bound, not proof of delivery provenance.

The registry contains one exact origin (`https://www.canva.com`), sender, selector,
subject/instruction rules and six-digit format. Common bounded raw MIME traversal
supports related/alternative and quoted-printable/base64 plain text. A single plain
text representation is authoritative for this pilot; HTML-only messages, attachments,
multiple plain parts, unsupported encodings and malformed containers refuse. HTML is
not rendered or used to select a code. This is an explicit coverage limit; visual
plain/HTML equivalence is not claimed. Subject/body code copies must agree, and the
code must occur on a standalone plain-text line. Different plausible codes refuse.

Key lookup uses only `https://dns.google/resolve`, no cookies, redirects or referrer,
a two-second deadline and 16 KiB response bound. It checks question/status/truncation,
requires DNSSEC checking enabled, and follows at most five CNAME answer links to one
TXT record. Google HTTPS resolver and its upstream DNS resolution are trusted pilot
dependencies. Canva's current answer reports AD=false; DNSSEC authentication is not
claimed. A compromised resolver or unsigned upstream DNS can defeat this key trust.
No mailbox address, raw mail, code or credential is sent to DNS. Public provider schema:
[Google DoH JSON API](https://developers.google.com/speed/public-dns/docs/doh/json).
The actual public selector lookup passed after accommodating current unquoted TXT data.

Automatic detection retrieves only when the saved automatic-prompt preference is on.
Eligible results open the extension popup containing a Fill button and no code.
Manual Find code / Retry uses the same policy when that preference is off. Only the
exact popup can accept the pending request. The coordinator rechecks account/mailbox,
focus, optional permission, document/URL, deadline, ambiguity and local blocks before
release; the content script rechecks the original field and preserves user values.
There is no extension submission or submit-button click. Page scripts can read the
inserted value and may react to input events.

Reserve a SHA-256 binding of account/mailbox/Gmail message ID in trusted-context local
storage before release. Only digest and ten-minute expiry persist, capped at 1000.
No OTP, OTP hash, raw message, credential or plaintext mailbox is stored. Corrupt,
unavailable or full ledger refuses. Reservation is never rolled back, including
uncertain send/ack outcomes. A worker crash before reservation sends nothing; crashes
after reservation refuse that message on restart. Requests and codes are volatile.
This bounds same-installation message reuse; an unseen intact copy under a different
Gmail ID, another installation, or a replay before its first reservation remains
unproven. DKIM does not bind a code to the site's current server-side transaction.

Alternatives: fabricated receiver PASS evidence was rejected in Core 2. Requiring
DNSSEC AD=true would currently leave Canva unsupported. Automatic insertion was
superseded by the owner's clicked-fill scope. No backend mail processing, extra Gmail
scope or cloud-history activation was introduced.

Validation and live acceptance are reported separately in
[Core 3 acceptance](../core-3-acceptance.md). Fresh owner-confirmed login remains required;
historical DKIM verification and synthetic tests are not that acceptance.
