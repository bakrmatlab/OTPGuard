# Core 2 independent receiving-boundary verification

Checked October 4, 2026 against public primary documentation. No mailbox,
credentials, original message, permission change or live code was accessed.
This independently reviews [sender research](core-2-sender-research.md), with
particular attention to whether a Google ARC seal changes its conclusion.

## Result

No documented public Gmail API mechanism was found that satisfies the current
design's direct-receipt, import/forward exclusion and replay gates together.
This is an absence of a sufficient reviewed contract, not proof that a stronger
Google contract or a different architecture is impossible. Keep sender decisions
UNKNOWN and real fill disabled under the existing design.

## API delivery-source evidence

The complete documented Message schema has no SMTP-versus-insert/import source
field or structured sender verdict. `historyId` records the last message change;
`internalDate` describes creation time with different SMTP and migrated-mail
semantics. Header objects contain names and values, without producer provenance.
Workspace classification labels are classifications, not a documented receipt
attestation. These are direct observations of the schema, not claims about hidden
Gmail implementation behavior.
[Message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages).

Google documents insert as resembling IMAP APPEND and bypassing most scanning and
classification. Import scans/classifies similarly to SMTP delivery. Both accept
a Message body and expose an internal-date source option. Its `receivedTime`
choice sets the time to Gmail's current receipt time; `dateHeader` uses a valid
Date header. Thus rejecting old timestamps cannot by itself reject a recently
introduced copy. OTPGuard readonly scope does not eliminate other mailbox
ingestion paths.
[Insert](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/insert),
[Import](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/import),
[InternalDateSource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/InternalDateSource).

## Google ARC seals: stronger evidence, insufficient receipt binding

A cryptographically validated, explicitly trusted Google ARC set would provide
stronger evidence than an unsigned `Authentication-Results` string: ARC binds a
sealer's assessment to message integrity. The standard permits inbound sealing,
but does not require it. `cv=none` includes non-ARC upstream handlers, so even a
valid first set does not prove absence of forwarding. ARC expressly retains
replay attacks: intact chains may be resent without invalidating signatures.
An ARC-Seal covers ARC-set fields; the message signature covers selected message
headers and body. Neither standard supplies binding to a Gmail API message ID,
current mailbox insertion event or current page request.
[RFC 8617 sections 4.4, 5.1.1, 5.1.5, 9 and 9.5](https://www.rfc-editor.org/rfc/rfc8617.html).

The preceding binding conclusion is an engineering inference: an original,
validly sealed raw copy can retain the same cryptographic evidence while its
mailbox introduction changes. A fresh API timestamp does not add a signed link
to that introduction. A signature timestamp can bound age, but is reusable
within that age window. Local deduplication only covers previously observed
copies. These facts prevent treating a valid Google seal alone as proof that
this current API record came directly from the approved service.

Google's authentication help describes how Gmail uses ARC when evaluating
forwarded mail, including historical failure results. It does not promise an
API-consumer rule establishing which Google seal belongs to the current mailbox
receipt or excluding preserved imported copies.
[Gmail authentication help](https://support.google.com/mail/answer/180707?hl=en).

## Concrete next evidence or architecture choice

To preserve the present contract, request a provider-supported attestation that
binds receiver authentication, direct transport classification, recipient and
receipt event to the API record, with documented insert/import/replay behavior.
Successful header experiments could corroborate such a contract; they cannot
create it. No such contract was located in the reviewed references.

If the owner chooses a narrower signer/content-integrity product contract,
local raw DKIM or trusted-sealer ARC verification merits a separate scoped
prototype and ADR. That choice must explicitly address remaining replay and
delivery-path limits before service activation. A controlled receiver or
service-issued signed transaction attestation is another architecture option;
server mail processing would require a deliberate privacy-contract change.
These alternatives are inferred engineering routes, not authorization to
implement or broaden permissions.

## Verification limits

This review independently confirms the central documented-contract finding and
adds the Google-sealer analysis. It does not claim import preserves every header
in every configuration: that would require controlled testing and a supported
provider guarantee. No real sender, template, input event or site acceptance is
established here. A public Google Workspace ARC help URL returned an error during
this review and is not used as evidence. Source links above were opened and read.
