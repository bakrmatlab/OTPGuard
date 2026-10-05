# Canva evidence and Core 3 handoff

Observed October 4, 2026 in the owner’s Chrome/Gmail session. No raw message, recipient address, live code, signature material or screenshot is retained here.

The owner confirmed a six-character numeric email code. Canva presented one editable Code field. The public sender was `no-reply@account.canva.com`; the message instructed use within ten minutes. Successful Canva login has not yet been confirmed.

Gmail Original Message reported SPF, DKIM and DMARC PASS. The approved candidate signature used `d=account.canva.com`, selector `rsp6babxccyfzajomulkoj3m6cqtnhls`, RSA-SHA256 and relaxed/simple canonicalization. It signed From, To, Subject, Date, Message-ID, MIME-Version and Content-Type. A separate Amazon SES signature was present. No body-length limit or signature expiration was present.

The rendered Gmail original text failed the body hash. Exact original bytes fetched in memory from Gmail’s original download endpoint, with a bounded response and checked attachment redirect, passed the local Chromium Web Crypto prototype using the public selector key obtained through system DNS. Verification at the signed timestamp returned content-authenticated; verification at current time refused the stale message. The signed recipient matched the connected owner account privately. This is historical cryptographic evidence, not fresh live acceptance or proof of direct receipt. Forwarding, import and replay remain unresolved by DKIM alone.

The actual MIME shape was multipart/related containing multipart/alternative, with quoted-printable plain text and HTML. Existing normalization rejects that shape; existing extraction also needs to distinguish repeated copies of the same code from distinct ambiguous candidates and benign expiry numbers. Implement these once in the shared engine with bounded parsing and refusal tests. Do not add a separate Canva mail engine.

The owner authorized Core 3 in a new chat: shared Gmail-to-fill flow, Canva first, automatic extension-controlled prompt and user-clicked Fill. Remaining resolver trust, parser integration, production wiring and fresh owner-confirmed fill are acceptance work there. Production retrieval and fill remain disabled in the current artifact. Preserve existing grants and sessions. No push, merge or deployment is authorized.
