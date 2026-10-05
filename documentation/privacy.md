# Prototype privacy and data handling

This describes the current source and its disabled integration seams. It is not a published
store privacy policy or proof of provider review. The default demo needs no account or mail.

| Data                  | Location and current handling                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local settings        | Trusted-context Chrome storage: version, random installation UUID, autofill preference and exact HTTPS blocked origins; profile-local, never synced today                                                    |
| Local history         | Version plus service ID/null, FILL action, result/reason enums, timestamp and installation UUID; at most 500 records, seven-day logical visibility; normal production history empty because fill is disabled |
| Gmail token           | Optional worker operation locals and Chrome-managed cache; no application refresh-token/token persistence; Google profile Authorization header or revoke POST body only                                      |
| Mailbox identity      | Optional worker memory and popup display; not stored as application data, exported or uploaded; revalidated after restart using only local connection-intent digests                                         |
| Clerk session         | Production shared-session auth now configured and basic live checks passed; worker-only probes and no application cache; browser-owned provider cookies remain separate                                      |
| Email/OTP             | No active production message retrieval/fill; reusable processing keeps objects transient; only fabricated demo codes are used in fixtures/assets                                                             |
| Future cloud metadata | Inactive account-scoped boolean settings, installation status/time and separate six-field history contract; no current app transport/upload                                                                  |

No OTP, OTP hash, message body/subject/snippet, message/mailbox/account identifiers, raw URL,
exact destination hostname, arbitrary error text or Gmail credential belongs in history or
OTPGuard backend payloads. Exact blocked origins are local settings, not history. Activity
metadata still reveals behavior; minimization is not anonymity or a Google policy exemption.
Local preferences/history survive OTPGuard account changes and belong to the browser profile.

Local expired history is excluded on read/export and physically pruned on startup/access;
inactive disk bytes may remain until execution resumes. Popup export intentionally creates
user-managed JSON, whose deletion/retention is outside extension control. Explicit Delete
clears local history; corrupt records remain unavailable until deletion. Account logout and
Gmail disconnect do not mean history deletion. Removing a block does not authorize a site.

Future cloud history is limited to 30-day logical visibility/500 records, with hourly cleanup
and bounded continuation defined in code. Physical expiry, backups and scheduler execution
are unverified. Opt-out/deletion atomically erase current backend events and disable consent;
failed remote deletion must report failure. Client abort cannot undo an already committed
server write. No current dashboard cloud export/delete or account deletion is available.

Gmail readonly consent is broad mailbox permission, not OTP-only access. Current lifecycle
uses only profile identity; real retrieval is disabled. Disconnect cancels work immediately,
drains pending consent, clears local cache and attempts revocation only for a remembered,
rechecked mailbox. Without that binding, remote revocation remains unconfirmed. Provider
revocation is asynchronous and may affect grants in the same Google project. Browser-owned
tokens/cookies and original mail are not erased by dropping application references.

The app adds no analytics or mail/code logging. Live provider SDK/network/logging behavior
has not been independently accepted. Never capture personal accounts, mail, OTPs, tokens or
credential-bearing URLs in diagnostics, test artifacts or screenshots. Tests use isolated
profiles, trace/video off and synthetic inputs. [Screenshot provenance](images/README.md)
records the checked-in assets. Toolchain telemetry is disabled in documented build commands.

String cleanup is best effort, not secure memory erasure. A page can read an inserted input;
split insertion may be partial if the page interferes, and the page may submit on its own.
OTPGuard itself never initiates submission. Browser/device/mailbox compromise and malicious
approved-site scripts remain outside this protection. See [threat model](threat-model.md).

## Domain-authentication revision

Website and extension now share the selected provider session in this browser profile
when production setup is authorized. Website and extension sign-out end that shared
session; they do not delete local history, revoke Gmail consent or sign out other
browser profiles. Cookie observation and fresh checks are bounded, not instantaneous
remote revocation. Failed logout suspends this worker; restart revalidates remote state.

The optional read-only Convex probe sends a fresh short-lived Clerk template JWT only
in Authorization to the exact configured deployment. No Gmail/mail/OTP or installation
metadata accompanies it. The backend returns a validated subject to the worker, which
compares it locally and exposes only a fixed acceptance state to the popup. Provider
cookies remain browser-owned; no application credential cache is added. Website UI
and public configuration contain no secrets. Google social login stays separately
unverified, including its callback URL behavior. See [domain auth plan](domain-auth.md).

## Core 1 connection revision

The controlled combined extension requires a fresh Clerk session for explicit Gmail
Connect and connection checks. Its volatile mailbox binding belongs to that selected
Clerk user/session; a session change requires disconnect before another session can
inherit it. Gmail and Clerk addresses remain independently displayed and may differ.
Core 4 now remembers explicit connection intent using two local SHA-256 account/session
and mailbox-binding digests. After restart, fresh matching Clerk authority, existing
noninteractive Chrome grant, readonly scope and Gmail profile are required before
restoring a connection. No plaintext identity or token is persisted. Disconnect removes
the intent first. A changed session or missing/revoked grant requires explicit Connect.
See [ADR0021](adr/0021-core-4-remembered-mailbox-and-late-challenges.md).

The old Gmail client, new combined-extension client and social-login client currently
share one Google project. Google revocation removes this account's project grants
across clients/scopes. Disconnect warns and confirms that breadth before attempting
revocation, then clears this extension's Chrome cache. Live revoke/disconnect was not
performed in Core 1, to preserve the old grant. No promise of per-client remote grant
isolation is made. See [acceptance and policy status](core-1-acceptance.md).

## Core 2 local DKIM prototype

The owner-selected development-only raw DKIM experiment authenticates covered
content against an explicit signer/sender/recipient rule, with signed freshness.
It provides no direct receipt or replay-exclusion claim and cannot produce production
VERIFIED evidence. Raw bytes and keys are in memory; no persistence, logging, live
resolver, Gmail reader or permission expansion is added. Synthetic key resolution
receives only an approved selector/domain query. Production registry, sender UNKNOWN,
receipt unverified and real fill disabled remain unchanged. A copied recent valid
signature can verify again; future release needs reviewed real-service evidence and
crash/dedup handling, with unseen replay still a residual risk.
[ADR0019](adr/0019-local-dkim-prototype.md) and
[acceptance](core-2-dkim-prototype-acceptance.md) describe scope and remaining gates.

## Core 3 pilot data flow

For a current supported request, the worker now reads bounded recent Canva raw Gmail
messages in memory. Public DKIM key queries go to Google's HTTPS DNS resolver and
contain only the signer/selector; no mail, mailbox, code or credential goes there.
Codes leave the worker for the bound Canva field only after an extension-popup Fill
click. Local release metadata contains a SHA-256 account/mailbox/message binding and
expiry, never plaintext mailbox, mail or OTP/hash of an OTP. Cloud history remains off.
See [ADR0020](adr/0020-core-3-signed-content-clicked-fill.md). Full live privacy acceptance
remains unverified; source-level absence of persistence does not prove a browser audit.

Core 4 connection intent is stored as version plus two digests in trusted-context local
storage, without time-based retention; removal/replacement or uninstall clears it. It
is not exported or uploaded. It cannot authorize a request without fresh provider checks.
