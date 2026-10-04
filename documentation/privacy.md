# Prototype privacy and data handling

This describes the current source and its disabled integration seams. It is not a published
store privacy policy or proof of provider review. The default demo needs no account or mail.

| Data                  | Location and current handling                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local settings        | Trusted-context Chrome storage: version, random installation UUID, autofill preference and exact HTTPS blocked origins; profile-local, never synced today                                                    |
| Local history         | Version plus service ID/null, FILL action, result/reason enums, timestamp and installation UUID; at most 500 records, seven-day logical visibility; normal production history empty because fill is disabled |
| Gmail token           | Optional worker operation locals and Chrome-managed cache; no application refresh-token/token persistence; Google profile Authorization header or revoke POST body only                                      |
| Mailbox identity      | Optional worker memory and popup display; not stored as application data, exported or uploaded; lost on worker restart                                                                                       |
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
