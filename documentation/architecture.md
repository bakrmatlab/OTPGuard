# Architecture

OTPGuard is a Chrome MV3 extension and a Next.js website. The extension finds a
recent email verification code in Gmail and inserts it into the current page after
the user clicks **Fill**. The website (otpguard.net) handles sign-up, guided setup
and management of the extension in this Chrome profile.

## Workspaces

| Path                | Role                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/extension`    | MV3 extension built with Bun: background worker, content script, popup, Options page                 |
| `apps/web`          | Next.js site: home, sign-in/up (Clerk), setup, dashboard                                             |
| `packages/otp`      | Raw MIME normalization, address parsing, generic code parser                                         |
| `packages/security` | Origin canonicalization, generic candidate assessment, timing and retrieval limits                   |
| `packages/shared`   | Message contracts, settings and activity schemas                                                     |
| `configuration`     | Public extension identity and provider configuration used by builds and tests                        |
| `scripts`           | Extension build, configured export, review packaging, test fixture server                            |
| `tests`             | Playwright specs and repository checks on build output; unit tests live in each workspace's `tests/` |

## Request flow

1. **Site access.** Setup requests optional `https://*/*` access once. Only after
   that grant does the worker register `content.ts`, on top-level frames only.
2. **Detection.** The content script scans the light DOM for single or split code
   inputs: at most 200 inputs, every 500 ms for the first 60 s, then on DOM
   mutations at most every 500 ms. It sends only closed `detect`, `challenge` and
   `cancel` messages. Page text is a hint, never trusted input.
3. **Admission.** The worker checks the sender (this extension, frame 0, active
   document), the live frame URL and origin, local settings and blocks, the Clerk
   account and the connected mailbox. It sets a receipt window: from 1 s before a
   new-code click or a fresh field, otherwise from 60 s before detection.
4. **Retrieval.** Gmail is polled at 0, 2, 6, 12, 22, 32 and 42 s inside a 60 s
   search budget. Each cycle lists messages by time only, spam and trash included:
   up to 50 IDs over 5 pages of 20. It fetches every raw body with 4 parallel reads,
   then lists again and refuses the cycle if the set changed. Limits: 512 KiB per
   response, 8 MiB and 30 s per cycle, 10 s per request. A network failure discards
   the cycle and the next poll retries; a quota reply waits for its retry time. A
   size cap, schema or decode failure ends the search. No partial set reaches
   selection.
5. **Selection.** Each message is normalized (`packages/otp/raw.ts`) and parsed
   (`packages/otp/generic.ts`). Receipt time, recipient contradictions, field length
   and sender-domain or subject hints narrow the set. More than one plausible code
   refuses as ambiguous. There is no newest-code tie-breaker.
6. **Confirmation.** The popup shows the found code and **Fill**. The user has 30 s
   to click. After the click, release must finish within 15 s.
7. **Release.** The worker sends `prepare`, rechecks, reserves the message in the
   release ledger, rechecks again and sends `release` with the code. The content
   script writes through the native value setter with `beforeinput`, `input` and
   `change` events, then watches for 500 ms that the value stays. OTPGuard never
   submits a form.

After every await the coordinator rechecks the tab, document, URL, origin, focus,
account, mailbox and settings. Any change cancels the request. A worker restart
discards all requests and approvals.

If a field looks like a code field but the page does not clearly ask for an email
code, the popup can ask the user to confirm that an email code was sent. That
intent lasts 30 s and still needs a separate Fill click.

## Trust boundaries

- **Background worker.** Owns Gmail tokens, mail and codes. Nothing else receives
  a token, a message body or a code before release.
- **Popup and Options.** The worker accepts their messages only from the exact
  extension URLs, with closed schemas. The popup is the only Fill authority. The
  Options page (`management.html`) manages settings and history but cannot reach
  pipeline status, confirmation, retry or Fill.
- **Content script.** Runs in the page's frame. Its messages are hints; the worker
  derives tab, document and origin from Chrome, not from the message.
- **Website.** `externally_connectable` admits one exact HTTPS origin. The worker
  also requires the top-level `/dashboard` document and a matching Clerk user and
  session. The website gets metadata and management actions, never codes. See
  [ADR 0003](adr/0003-website-browser-management.md).
- **Mail.** Sender identity is never verified. A code is a candidate, and the Fill
  click is what authorizes release. See
  [ADR 0002](adr/0002-user-confirmed-generic-fill.md).

Permissions: `storage`, `scripting`, `webNavigation`, plus `identity` with Gmail
and `cookies` with the account configured; optional `https://*/*`; Chrome 127 or
later; no web-accessible resources.

The manifest limits network reach. A configured build allows only the Gmail API,
Google token revocation and the Clerk Frontend API in `host_permissions` and
`connect-src`. An unconfigured build has `connect-src 'none'`.

## Account and Gmail

A signed-in OTPGuard account (Clerk) is required before any fill. The website and
the extension share one Clerk session in this browser profile; see
[ADR 0001](adr/0001-shared-website-session.md). The OTPGuard account and the Gmail
mailbox can be different addresses.

Gmail uses `chrome.identity` with the `gmail.readonly` scope. Explicit Connect
stores a version number and two SHA-256 digests: the Clerk user and session, and
that pair plus the mailbox address. After a worker or browser restart, the worker
restores the connection only after fresh checks of the Clerk session, a
non-interactive Chrome grant and the Gmail profile. No token or plaintext identity
is stored. Chrome chooses the Google account; a Chrome sign-in change invalidates
the Gmail connection.

Disconnect removes the digests first. If the worker knows the connected mailbox
and the current Google account still matches it, it asks Google to revoke the
grant; otherwise it reports revocation as unconfirmed. It then clears Chrome's token
cache. Revocation applies to every client in the same Google Cloud project.

## Replay protection

The release ledger stores a SHA-256 of account, mailbox and message ID for each
reserved message, kept for 10 minutes in trusted-context local storage. A
reservation is never rolled back, even when delivery is uncertain. A second
attempt on the same message refuses as `already-used`.

## Email coverage

| Supported                                                                       | Refused or unsupported                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Plain text, HTML-only, multipart alternative/related/mixed                      | Forwarded, replied or attached email bodies; encrypted mail |
| 7bit, 8bit, base64, quoted-printable; UTF-8, ASCII and standard legacy charsets | Malformed MIME, unknown charsets, unsafe control characters |
| Encoded and missing subjects                                                    | Reset, recovery, payment, SMS and authenticator purposes    |
| English code wording; code in subject, same line, next line or table cells      | Non-English-only wording                                    |
| 4–8 ASCII letters or digits, case and leading zeros kept; `ABC-123` grouping    | Symbols, other lengths, other punctuation                   |
| Images and binary attachments, ignored as inert resources                       | Two distinct plausible codes in one message or across mail  |

Limits per message: 256 KiB raw, 64 parts, depth 8, 32,768 characters of text.
`packages/otp/tests/generic-email-coverage.test.ts` and
`apps/extension/tests/otp-format-matrix.test.ts` hold
the synthetic cases.

## Local data

Settings, blocks, activity history, the release ledger and the connection digests
live in `chrome.storage.local` with access limited to trusted extension contexts.
History keeps at most 500 records for 7 days. A fresh install starts with automatic
finding on. [Privacy and security](privacy.md) lists every stored field.

## Known gaps

- Nothing ties a code to the site that asked for it. A page can trigger a real code
  to your mailbox and receive it if you click Fill.
- Two listings are not an atomic Gmail snapshot. Mail indexed after the closing
  listing can be missed.
- Iframes, shadow roots, magic links, multiple mailboxes, incognito and other
  browsers are not supported.
