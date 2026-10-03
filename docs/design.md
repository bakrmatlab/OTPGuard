# OTPGuard — Working Build Design

Status: reviewed working specification, with proposed defaults and feasibility gates.
Reviewed: October 3, 2026.

The original brief is preserved in [project-handoff.original.md](project-handoff.original.md).
This document consolidates its requirements and resolves ambiguities for implementation.
New policy choices below are proposed defaults, not previously approved product decisions.
The accompanying [design review](design-review.md) explains the significant changes.
The [implementation plan](implementation-plan.md) breaks delivery into reviewable PRs;
[HANDOFF.md](../HANDOFF.md) is the repository's engineering entry point.

## 1. Product and security contract

OTPGuard is a Chrome extension that retrieves recent Gmail verification emails locally
and fills a code only when a supported email template, sender identity, destination,
and current page request satisfy its security policy.

The product reduces accidental disclosure of email OTPs to unrelated origins. It does
not make email OTP authentication phishing-resistant, guarantee that a website is safe,
or prove that an email belongs to a particular server-side login transaction.
Once a code enters a page input, that page's scripts can read it. A compromised approved
site, malicious extension, compromised mailbox, or compromised browser/device remains
outside the protection offered by domain matching.

Security invariants:

- No OTPs, message bodies, subjects, snippets, or Gmail credentials reach OTPGuard servers.
- No live or personal OTPs enter persistent extension storage, URLs, logs, telemetry,
  or test artifacts. Deliberately synthetic test codes may appear in development fixtures
  and test expectations; those fixtures are excluded from production bundles.
- Email and page content are untrusted inputs.
- Parser scores never override a failed authorization gate.
- Only the background worker authorizes a fill; the content script cannot declare an origin trusted.
- Every fill belongs to one Gmail account, tab, document, origin, and detected field group.
- Unknown or ambiguous evidence prevents release of the code to the page.
- Manual fill uses the same authorization policy as automatic fill.
- No form submission or submit-button click is initiated by the extension.

Removing references to strings is best-effort cleanup, not guaranteed memory erasure.
OTPGuard cannot erase the original email or guarantee deletion of a code from page memory.

## 2. Scope and supported behavior

MVP includes Chrome MV3, Plasmo, React, strict TypeScript, one connected Gmail mailbox
per extension installation, numeric codes, single and split inputs, popup status,
secure automatic fill and manual retry/fill for verified requests.

Start with two or three email-code flows demonstrated using sanitized real fixtures.
GitHub, Google, Microsoft, Discord, and Amazon are candidate services, not promises of
coverage. A service enters the supported registry only after its actual sender,
authentication evidence, template, destination origins, and code format are tested.
The GitHub sample in the original brief is illustrative, not a validated integration.

Support top-level HTTPS documents only initially. Cross-origin and same-origin iframe
fields, closed shadow roots, magic links, alphanumeric codes, custom trust overrides,
copy-only mode, auto-submit, multiple mailboxes, incognito, and Firefox are deferred.
Open shadow roots can be added after ordinary input handling is stable.
Local HTTP fixtures are permitted only through an explicit development configuration.

Clerk account authentication and a minimal Next.js sign-in host are included in the
connected prototype. Convex metadata synchronization follows the core local pipeline.
The polished dashboard remains a later milestone.

## 3. Architecture and ownership

```text
Gmail API <-> background worker -> short-lived approved fill -> content script -> input
                    |
             local settings/status
                    |
           optional metadata sync -> Convex -> Next.js dashboard

Clerk <-> extension account session / Next.js account session
```

- Background: Gmail authorization, bounded retrieval, parsing orchestration, request
  coordination, policy enforcement, and metadata sanitization.
- Content script: detect visible eligible fields; report minimal signals; fill only
  an approved current request; acknowledge success or failure.
- Popup: account identity, mailbox identity, permission state, status, manual retry,
  verified manual fill, settings, and dashboard navigation.
- Pure OTP package: MIME/text normalization and template/candidate extraction.
- Pure security package: sender evidence, registry matching, origin checks, and typed decisions.
- Browser adapter: identity, messaging, document lifecycle, permissions, and storage.
- Convex: per-user settings and optional activity/device metadata, never email processing.

Use a monorepo with apps/web, apps/extension, packages/otp, packages/security,
and a small packages/shared for genuine shared contracts. Add packages/ui only when
there is actual UI reuse. Pure packages must not depend on React or Chrome APIs.

## 4. Gmail authorization and browser permissions

Use Chrome's identity API as the initial Gmail authorization approach. Spike it early
with a stable development extension ID and correctly registered Google OAuth client.
Check granted scopes and confirm the connected mailbox using the Gmail profile API.
Request consent only from an explicit Connect Gmail action. Handle denial, revoked
access, expired tokens, account changes, and reconnection without surprise prompts.

Proposed Gmail scope: gmail.readonly. It permits broad mailbox reading; restricting
queries to OTP candidates is an application behavior, not an OAuth access boundary.
gmail.metadata cannot retrieve email bodies. There is no general-purpose OTP-only
scope for this extension. Do not request modify, send, or full-mail scopes.

Let Chrome manage its token cache; do not add refresh-token storage in Convex or
extension storage. OAuth client IDs are public configuration. No client secret can
be kept secret in an extension bundle, including through environment variables.

Initial browser access: identity, storage, and tightly scoped host access for the
selected Gmail API endpoint and actual Clerk/Convex endpoints. Use per-site optional
host permission for supported services with a clear Enable on this site action.
Use scripting if required for dynamic injection; document any additional permission
from generated manifests or SDK behavior. Avoid all_urls, broad tabs access, and
webRequest unless an identified requirement proves necessary.

activeTab can support a click-to-run demonstration, but does not authorize unattended
autofill across arbitrary future page visits. Automatic detection requires permission
and content-script registration for the sites on which it operates.

Public release needs a separate Google restricted-scope verification review and
Chrome Web Store privacy/permission review. Local-first processing does not itself
remove OAuth verification obligations. Assess whether transmitted Gmail-derived
metadata changes Google's security-assessment requirements before enabling cloud logs.

## 5. Email identity and service registry

Sender names, From addresses, email text, and links are insufficient proof of origin.
Use a supported sender mapping plus authenticated sender evidence from a documented
trusted receiving boundary. Require a tested aligned authentication result appropriate
to the supported service; an SPF pass for an unrelated domain is insufficient.

Authentication-Results headers can themselves be forged. Never accept any matching
header merely because it contains dkim=pass or dmarc=pass. The Gmail spike must establish
how receiver-added evidence is distinguished from attacker-supplied headers using
real and adversarial fixtures. If that boundary cannot be justified, sender identity
is UNKNOWN and production autofill remains disabled. Gmail's message resource is not
by itself a structured attestation that a sender has been authenticated.

Forwarded messages and attached/quoted verification emails are unsupported initially.
Never follow email links or load remote images to identify a service. Parse bounded
plain text or inert HTML locally, with no script execution or external resources.

Each registry entry defines:

- Service ID and name.
- Exact approved HTTPS origins, with any subdomain rule explicit and justified.
- Approved sender addresses/domains and authenticated-domain relationships.
- Supported templates, code lengths, and login/verification purpose.
- Freshness limit and ambiguity rules.
- Fixture provenance and date last validated.

Registry rules ship with the extension. Cloud preferences cannot silently broaden
the authorization registry. Separate sender domains from destination origins;
third-party email delivery and identity-provider redirects require explicit mappings.

## 6. Destination authorization

Normalize URLs with a proper URL parser and compare approved origins, including scheme,
hostname, and port. Canonicalize internationalized hostnames consistently. Show the
ASCII hostname in security details where a Unicode rendering could mislead.

Use a maintained Public Suffix List implementation for registrable-domain analysis,
including private suffix handling. Registrable-domain equality is contextual evidence,
not a blanket authorization rule. An arbitrary subdomain can host a different tenant
or be compromised. Even www.github.com requires an explicit registry policy.

Never trust page titles, logos, query parameters, email links, or hostname substrings
as destination authorization. Reject non-HTTPS origins and unexpected ports in production.
Embedded identity-provider fields are unsupported in MVP; later iframe support must
validate both frame and top-level origins with explicit embedding policy.

## 7. Request binding and code selection

1. Detect a visible, enabled OTP field group using multiple signals. A generic code
   name or numeric input alone is insufficient; avoid payment, recovery, and TOTP fields.
2. Start a bounded request when the foreground page has evidence of an email-code flow.
   Uncertain email-versus-authenticator flows require user-triggered retrieval.
3. Bind a request ID to account, tab, browser-provided document identity, origin,
   field-group identity, start time, and deadline. Validate runtime message senders
   and schemas; derive security context from browser metadata, not message claims.
4. Retrieve bounded candidates and apply sender, service, destination, template,
   freshness, and ambiguity gates before authorizing release.
5. Immediately before release, recheck that the tab is foreground and document and
   origin are current. The content script rechecks the request and field group before
   inserting anything. Navigation, account changes, or replaced fields invalidate approval.
6. Record local fill acknowledgment and discard code references. A DOM fill is not
   evidence that the server accepted the code.

Initial proposed limits: candidate age at most five minutes or a stricter service
limit; allow a 60-second lookback before field detection because mail may arrive first;
request deadline 60 seconds; in-memory approved-code lifetime at most 30 seconds.
Use Gmail internalDate rather than sender-controlled Date as receipt evidence, while
excluding unsupported imported/forwarded flows. These bounds reduce stale selection
but cannot establish server-side challenge identity or actual code validity.

Prefer precise template extraction. Preserve codes as strings, including leading zeros.
Length alone is insufficient. Reject ambiguous multiple codes, unsupported purposes,
and multiple plausible same-service messages or tab requests when there is no reliable
way to distinguish the intended challenge. Never silently select the newest code to
resolve a genuine account/challenge ambiguity.

## 8. Retrieval, retries, and worker lifetime

Perform an immediate query and retries at elapsed times 2, 6, 12, and 22 seconds
(proposed default). If no result arrives, stop and offer Retry. Respect provider
Retry-After and quota responses; authentication failures require reconnect or a bounded
noninteractive token refresh, not repeated polling.

Proposed bounds: at most 20 candidate IDs and 10 message bodies per query cycle,
with a decoded message size cap of 256 KiB. Skip oversized or unsupported messages.
Do not assume list results are ordered; compare eligible timestamps locally.
Coalesce retrieval for concurrent requests to the same mailbox while keeping approvals
separate. Deduplicate detection events and stop on success, cancellation, navigation,
loss of foreground status, disconnect, or timeout. Never send full DOM text to Gmail
search queries; use registry-derived sender filters and bounded time windows.

Worker termination is normal. Timers are best effort, not a durability mechanism.
Do not keep the worker alive artificially. A new content-script request may restart
retrieval after termination, but must obtain fresh authorization and recheck deadlines.
Persist only nonsecret request/deduplication metadata if needed, never codes or email
bodies. Prevent a restart from filling a message already used in the same live request.
Store minimal short-lived local message-ID/account deduplication state if needed.

## 9. Field filling and UX

For supported single and split groups, preserve leading zeros, validate length and
field count, and avoid overwriting user-entered values. Use framework-compatible
native setters/events tested against fixtures; sites that reject synthetic events are
unsupported rather than grounds for weakening the security boundary.

Do not send the code through window.postMessage, DOM attributes, page globals, or
page-world scripts. Extension isolated execution does not make an input's value
private from the page. Some sites submit automatically on input completion; the UI
must not promise that filling always leaves submission under the user's control.

Decision states:

| State | Meaning | Behavior |
| --- | --- | --- |
| VERIFIED | All authorization gates pass | Fill automatically if enabled, otherwise allow verified manual fill |
| UNKNOWN | Unsupported or insufficient/ambiguous evidence | Keep code inside extension; explain limitation |
| MISMATCH | An identified candidate targets another service/origin | Refuse that candidate; explain destination mismatch when relevant |
| BLOCKED | Explicit local site policy prevents access | Do not retrieve or fill |

Operational statuses such as SEARCHING, NO_CODE, RECONNECT_REQUIRED, and ERROR are
separate from security decisions. A recent unrelated email alone is not proof the
current site is phishing. UNKNOWN is not labeled malicious. Warnings originate in
extension-owned UI; any page badge is informational and must contain no code.

Autofill can be disabled without disabling security enforcement. No MVP setting turns
phishing protection off. No copy, reveal, or manual override bypass for unverified
destinations. Users can continue their normal manual login outside OTPGuard.

## 10. Account, local state, and backend

Clerk identifies the OTPGuard account; Chrome/Google authorization identifies the
connected Gmail mailbox. They may be different accounts, and both identities must
be visible to the user. Validate Clerk session freshness at the start of connected
requests; an unavailable account session pauses retrieval and offers sign-in.
Check logout/account changes before release and cancel pending work on either change.

Gmail grants are local to a Chrome profile/installation and are not portable cloud
connections. The dashboard shows device-reported connection status with a last-seen
time, not a guarantee of a presently valid Gmail token on every device.
Disconnect cancels retrieval, clears mailbox-associated state and cached credentials,
and attempts provider revocation; clearing a local cache alone is not revocation.
Distinguish account logout, Gmail disconnect, device deregistration, and account deletion.
Remote device revocation can stop future authenticated sync/connected requests when
observed; it cannot instantly revoke an offline installation's Google grant.

Keep settings local for the first pipeline. Add Convex for account-scoped settings,
devices, and optional activity once needed. Every query/mutation derives ownership
from validated Clerk identity and rejects cross-user access, including spoofed device IDs.
Device IDs represent installations, not hardware identity or security attestation.
Explicit local blocks win over any synchronized preferences.

Activity metadata is sensitive: service/domain/time can reveal login behavior.
Default to local history with a proposed seven-day retention. Make cloud history
opt-in with a proposed 30-day retention and deletion/export controls. Cloud events
contain service ID, action/result, enum reason, time, and installation ID; omit raw
URLs, paths, query strings, arbitrary message text, mailbox IDs, and OTP hashes.
Exact destination hostnames stay local by default. Review Google policy applicability
before shipping cloud events derived from mailbox processing.
Cloud logging failure must not prevent an otherwise locally authorized fill.

## 11. Delivery order

1. Foundation and local fixtures: extension installation, messaging, detection,
   single/split field filling. Hardcoded fake codes run only on explicit local test pages.
2. Mock secure vertical slice: parser, registry, sender-evidence adapter, request
   binding, decision engine, navigation cancellation, and mismatch rejection.
3. Feasibility spikes: Chrome Gmail OAuth/scope/account behavior, authenticated sender
   evidence, supported real templates, and minimal Clerk extension/web session integration.
   Decide any stack changes from evidence and record an ADR.
4. Connected prototype: direct Gmail retrieval, MIME handling, retries, expiry,
   account transitions, privacy controls, and popup UX.
5. Metadata services: Convex identity enforcement, opt-in sync, retention, and minimal
   dashboard. Add the polished dashboard after the prototype is demonstrated.
6. Public-release preparation: permission/OAuth reviews, error handling, compatibility
   checks, documentation, packaging, and release workflow.

Tests, threat modeling, secret scanning, and CI start in steps 1–2 and grow alongside
each feature. They are not deferred to a final hardening phase.

## 12. Acceptance criteria

- Supported real email fixtures produce the exact code; leading zeros survive.
- Orders, dates, quoted codes, unsupported templates, and ambiguous candidates do not fill.
- Spoofed From/display names and forged authentication headers cannot yield VERIFIED.
- Lookalikes, unrelated origins, unapproved subdomains/ports, and iframes receive no code.
- Changing tab/document/account/fields during retrieval cancels or safely rejects release.
- Concurrent same-service challenges do not cause cross-tab or cross-account fills.
- User typing, denial of permission, revoked consent, no mail, oversized mail, quota
  errors, offline state, and worker restart yield bounded, understandable behavior.
- Each supported single/split fixture accepts the intended input events; unsupported
  pages receive a clear status without repeated injection.
- The extension never initiates submission; site-driven submission is documented.
- No live or personal OTP/email/token appears in persistent app storage, network traffic
  to OTPGuard infrastructure, logs, analytics, screenshots, or failure artifacts.
  Synthetic fixtures and controlled demo assets are clearly identified as such.
- Cloud ownership checks prevent one Clerk user accessing another user's data.
- Retention/deletion behavior and Gmail disconnect are verified.
- A supported real end-to-end flow and an adversarial mismatch flow are demonstrable.

Use synthetic emails for routine tests. Sanitize real fixtures before committing;
replace real codes and personal identifiers with synthetic values while preserving
the structure needed for tests; record how sanitization affects authentication evidence.
Never commit active codes or personal mail. Describe confidence scores as heuristics,
not calibrated probabilities. Define performance targets after measuring the supported
flows; Gmail delivery latency is outside the extension's control.

## 13. Open feasibility gates

Before enabling production automatic fill, resolve and record:

1. Which two or three actual email-code flows are supported, with validated fixtures?
2. What trusted sender-authentication evidence is available through Gmail, and how is
   its receiving boundary established against forged/duplicate headers?
3. Does the chosen Chrome identity flow reliably support the intended mailbox UX?
4. What exact permissions/CSP does the installed Plasmo/Clerk combination require?
5. What Google verification requirements apply to the actual data flows and distribution?

These are evidence gates, not reasons to delay the local mock pipeline.
