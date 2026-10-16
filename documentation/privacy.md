# Privacy and security

Mail and codes stay inside the extension. Gmail responses go from Google to the
background worker, which parses them in memory and releases a code only to the page
where the user clicked **Fill**. No code path sends mail or codes to an OTPGuard
server; there is no OTPGuard backend.

## Stored data

All extension data lives in `chrome.storage.local` with access limited to trusted
extension contexts. It belongs to the Chrome profile and survives OTPGuard sign-out.

| Data              | Contents                                                                                           | Retention                         |
| ----------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| Settings          | Version, random installation UUID, automatic finding flag, exact HTTPS blocked origins             | Until changed or uninstall        |
| Activity history  | Service ID (null for generic fills), FILL action, result and reason enums, time, installation UUID | 500 records, 7 days               |
| Release ledger    | SHA-256 of account, mailbox and message ID                                                         | 10 minutes per entry              |
| Connection intent | Version and two SHA-256 digests of the Clerk binding and mailbox                                   | Until Disconnect or a new session |

Not stored by OTPGuard: Gmail tokens (Chrome's identity cache holds them), mailbox
address (worker memory only), Clerk session (browser cookies owned by Clerk), mail,
codes, message IDs, URLs and page text. Request progress is a closed list of stage
names in worker memory.

History export creates a JSON file the user manages. Delete clears history. Signing
out or disconnecting Gmail does not delete history.

## What leaves the browser

- **Google.** Gmail API reads with `gmail.readonly`, and token revocation on
  Disconnect. Search queries contain only a time window.
- **Clerk.** Sign-in at otpguard.net and session checks from the worker. Clerk sees
  the account email, sign-in times and IP address.
- **otpguard.net dashboard.** After **Connect this browser**, the page receives the
  Gmail address, blocked origins, the automatic finding flag, the history count and
  the last result, reason and time. History JSON only on an explicit export. Never
  codes, mail or tokens. The site has no analytics and makes no backend calls with
  this data, but its scripts are trusted for these management actions.

The manifest enforces this. A configured build allows only the Gmail API, Google
token revocation and the Clerk Frontend API in `host_permissions` and `connect-src`.
To audit a build, read its `manifest.json`.

## Threats and controls

| Threat                                                 | Control                                                                           | Remaining risk                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A page triggers a real code and receives it            | Required Fill click; local site blocks                                            | The click is the only defense; no email-to-site link is verified |
| Spoofed, imported or replayed email                    | Receipt window, recipient checks, ambiguity refusal, release ledger               | Sender identity is never verified                                |
| Stale or competing code                                | Complete bounded mail set; two plausible codes refuse                             | A delayed old email inside the window looks fresh                |
| Navigation, focus, account or field change mid-request | Rechecks after every await; cancellation                                          | Browser races are bounded, not instantaneous                     |
| Worker restart during a request                        | Requests and approvals are memory-only; ledger reservations are never rolled back | None known                                                       |
| A page calls extension actions                         | Exact sender URLs, closed schemas, top-frame checks, trusted-context storage      | Browser or device compromise                                     |
| Token or mail leaks through network, storage or logs   | Fixed endpoints, no cookies, referrers or redirects, bounded streams, no logging  | Provider SDK behavior is not independently audited               |
| Dashboard XSS                                          | Website gets metadata and management actions only, never codes or Fill            | An attacker could change settings or read the metadata above     |

## Limits

- `gmail.readonly` is broad mailbox access, not code-only access, and is a Google
  restricted scope. Public release needs Google verification.
- Google revocation applies to every client in the same Google Cloud project.
- A page can read any value inserted into its fields. Split insertion can be partial
  if the page interferes. The page may submit on its own.
- Clearing strings from memory is best effort.
- This describes the source in this repository. A configured build or the deployed
  site can differ; check the built `manifest.json`.
