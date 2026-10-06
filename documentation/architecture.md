# Architecture and current decisions

The shipped entry points and the synthetic demonstration have different capabilities.

```text
Production popup -> exact worker actions -> Chrome local settings/history
                         |
                         +-> optional Chrome identity -> Google profile/revoke

Production web -> unconfigured account/security dashboard
Convex functions/schema -> offline ownership/retention tests (no active app transport)

Separate synthetic extension:
loopback field -> worker browser context -> fabricated mail -> pure parser/policy
              -> bound prepare/recheck -> document-targeted release -> live empty field
```

The extension is built with explicit Bun browser entries: background worker and React
popup. Only explicitly allowlisted public `PLASMO_PUBLIC_*` settings are embedded, preserving existing
public configuration and registered IDs. No generic env serialization or SDK asset-tree
copying occurs. The builder refuses a nonempty production content entry; site registration
requires a separately reviewed change.

## Ownership and trust boundaries

The background worker owns provider credentials and authorizes connected requests.
Popup messages require the browser's extension ID, exact popup URL and closed schema.
There is no token, mail-fetch, fill or cloud-upload message exposed to pages.
`apps/extension/content.ts` stays zero bytes: production has no injection, site permissions,
web-accessible resources or external messaging. Default CSP denies network access.
Optional Google config adds storage/identity and exact Gmail/revoke hosts; optional compatible
Clerk config adds cookies and an exact Frontend API host. Fixed adapters enforce paths,
because Chrome host-permission paths alone do not constrain fetch destinations.

Pure `packages/otp` performs narrow bounded normalization and extraction; parser scores
are heuristics, never authorization. Pure `packages/security` compares exact canonical
HTTPS origins, sender/receipt evidence, purpose, freshness and ambiguity. It returns
VERIFIED/UNKNOWN/MISMATCH/BLOCKED without code values. No domain-suffix trust or editable
registry is offered. A Public Suffix List is deferred because no registrable-domain analysis
is performed. The production registry is empty; Gmail sender remains UNKNOWN and
internalDate unverified. Adding entries alone cannot enable real release.

The coordinator binds account/session/generation, mailbox, tab, document, origin and field
group. It rechecks policy/current context after asynchronous preparation before release.
Content rechecks exact live empty eligible inputs and single-use approval. Navigation,
foreground loss, typing/field changes, account/mailbox/settings changes and disposal refuse
or cancel. Disposal is terminal before/after pending context reads. Worker restart discards
volatile work; it cannot resume approvals. Durable real-message reuse prevention is deferred
with real release. The demo's fabricated sender and destination translations stay outside
production entry graphs, in `development/mock-extension` only.

## Bounds and conservative behavior

| Mechanism           | Current bound                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Detection           | Top-level light DOM; 60 seconds/120 scans, 200 inputs; nearby context 2,000 text nodes/4,000 characters; 4–8 split fields |
| Parser              | English numeric 4–8 characters; 1,000 subject/32,768 text characters; ambiguity refuses                                   |
| MIME normalization  | 256KiB decoded body plus inspected headers, 64 parts/depth 8; strict inert HTML subset                                    |
| HTTP JSON           | Profile/list 16KiB; full message 512KiB; caps enforced before JSON parsing                                                |
| Retrieval seam      | 20 IDs/10 distinct bodies; pagination/overflow refuses; 0/2/6/12/22-second retries                                        |
| Request/approval    | 60-second request; at most 30-second approval; provider operations 10 seconds                                             |
| Local/cloud history | 7/30-day logical retention; 500 records; cloud currently disabled                                                         |

No links/images are followed during normalization, no attachment retrieval occurs, and no
newest-code shortcut resolves ambiguity. Coalescing requires matching account/session/mailbox/
service/time window and keeps approvals separate. No mail/code survives completion in an app
cache. These modules are tested seams, not active production retrieval.

## Account and cloud decisions

Clerk OTPGuard identity is distinct from Chrome's Gmail mailbox. Development URL credential
transport is unsupported; keep pk_test refusal, explicit no-cache worker adapter, fresh
authoritative session probes and cancellation. Current auth is unconfigured. Chrome owns
its token cache; mailbox identity remains worker memory. Consent occurs only on Connect.
Local disconnect/cache cleanup and remote revocation are separate outcomes.

Convex validates issuer-qualified identity for ownership; callers never choose an owner.
Installation UUIDs have immutable ownership and are not hardware attestation. Device reports
use server receipt time; five-minute staleness never establishes current token validity.
Sync transport is inactive, with local disable/blocks always winning over cloud preferences.
Cloud activity has separate opt-in/session binding and false client/server policy gates.
History sinks do not delay authorization. Offline tests exercise actual backend functions;
live JWT/two-device/scheduler/network acceptance remains unverified.

The dashboard cannot read extension storage and has no Convex endpoint. Local activity remains
in the popup. [Privacy](privacy.md) and [threat model](threat-model.md) describe persistent
fields, residual risk and audit repairs; [release gates](release-readiness.md) govern activation.

## Domain-hosted authentication revision

[ADR0016](adr/0016-domain-hosted-shared-auth.md) records the owner-approved shared
website/extension session. Standard website SignIn/SignUp runs at otpguard.net after
approved setup; worker-only production Clerk Sync Host reads the exact Frontend API
cookie and reloads the active session. Fresh identity and generation checks surround
the bounded read-only Convex subject probe; logout/cookie events cancel authority and
late replies. Failed remote logout locally suspends this worker until successful retry.
Browser/provider cookies remain persistent; the SDK application JWT cache is disabled.

The stable authentication public key/ID is separate from Gmail registration. Optional
probe configuration adds only the exact Convex host; metadata sync remains inactive.
No native experiment transport/build source or development issuer exception was ported.
The [deployment plan](domain-auth.md) is review material, not production readiness.

## Core 1 authenticated connection

Production popup Gmail messages enter `gmail/authenticated.ts` before the existing
Chrome lifecycle. A fresh Clerk user/session binding is checked before Google and
again after completion; account invalidation cancels mailbox work. A switched session
requires explicit disconnect, while different Clerk/Gmail emails remain valid.
Popup freshness checks, mailbox actions and cloud identity probes are serialized to
avoid superseding each other; timer polls skip active work. Logout still cancels
immediately outside that queue. Cleanup can run without Clerk. Requests and tokens do not survive worker restart. Core 4 now retains only two
nonsecret connection-intent digests and restores the same selected session/mailbox
through fresh authoritative checks without interactive OAuth. No token reaches
popup/content/backend. See [ADR0021](adr/0021-core-4-remembered-mailbox-and-late-challenges.md). The reviewed stable-ID artifact requests only Gmail readonly,
uses profile/revoke endpoints and has no site content entry or retrieval registration.

Public configuration and `scripts/build-core-1.ts` reproduce a new isolated controlled
export without copying owner env files. Old Gmail artifacts/clients remain distinct,
but Google project grants are shared: revocation affects other project clients and
requires an explained confirmation. [ADR0017](adr/0017-authenticated-gmail-connection.md)
and [Core 1 acceptance](core-1-acceptance.md) record actual evidence and remaining limits.

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

## Core 3 owner-controlled pilot

Core 3 supersedes the preceding prototype-only state: the shared production raw Gmail
pipeline is wired for one exact Canva origin with optional access. DKIM authenticates
signer/covered content, not direct receipt. The extension popup is the Fill prompt;
only a user click can precede release. Manual retrieval shares the policy. Related/
alternative MIME uses bounded authoritative plain text without HTML rendering.
A trusted-local write-ahead hashed message/account ledger prevents uncertain resend.
[ADR0020](adr/0020-core-3-signed-content-clicked-fill.md) and
[acceptance](core-3-acceptance.md) describe implementation and live limits.

## Current generic flow — October 5, 2026

ADR0022 supersedes the earlier disabled/site-specific production descriptions for
the owner-selected generic mode. After one optional HTTPS-wide grant, the top-level
content script detects email-code fields; the worker searches bounded recent Gmail
raw mail and extracts generic numeric candidates. Generic assessment returns CANDIDATE,
never VERIFIED. The exact extension popup must confirm Fill before prepare/reservation/
release. Account/mailbox/document/origin/focus/field checks and cancellation remain.
Unknown input lengths are resolved before prepare. Shared generic concurrency prevents
separate websites selecting the same candidate. History uses null service IDs.
Production has no DKIM DNS traffic or stored mappings; the reviewed policy remains
separate. See generic-fill-acceptance.md for actual evidence and coverage limits.

Generic format coverage additionally handles mixed MIME, subjectless mail, common
legacy charsets, spaced numeric codes and inline/table HTML layouts. Embedded images
and binary application attachments are inert resources, never code sources. Forwarded
or attached email bodies and encrypted MIME still refuse. SPA admission binds the
browser's live frame URL after document/origin validation because sender.url may
retain the original URL; exact URL/document checks remain at subsequent boundaries.
See [generic email coverage](generic-email-coverage.md).

Generic reliability revision (ADR0023): one worker-owned challenge window is shared
with retrieval and candidate selection; early email-request gestures and resend hints
contain no page-supplied timestamp. Retry preserves that window with a fresh polling
deadline. Explicit receipt/field/recipient/service contradictions can narrow matching,
while unknown competition refuses. Ordinary unreadable newsletters can be excluded
using bounded subject/snippet heuristics; other decoder failures keep the cycle incomplete.
Production insertion acknowledges retained values after 100 ms, without initiating
submission or overwriting intervening changes. No additional provider scopes or site
permissions are introduced. See generic-reliability-acceptance.md.

Request diagnostics now expose a volatile closed stage enum, elapsed timing and at most 12 last-observed stages to the popup. Admission, retrieval, exclusion and release stages share the same local observer; it has no authorization role. Concurrent checks can interleave stages.

Generic request follow-up: the background routes early challenge events through the
account/mailbox/page boundary. Admission is cancellable and consumes the same
60-second budget as retrieval and confirmation. Navigation cancels pending admission;
late provider results do not admit an expired request. Only detection starts a new
searching display. See [follow-up acceptance](generic-request-followup-acceptance.md).

Generic recipient hints use bounded rendered text, preserving block boundaries and
inline address fragments. Concatenated DOM text must not create a different address
by prefixing adjacent headings. Recipient contradiction still excludes a candidate;
this correction changes extraction, not the mailbox or release policy.

Generic parsing excludes explicitly marked copyright years/ranges from candidate
numbers, including when inert email text puts metadata on the same line as a code
label. Other four-digit numbers still require the existing context rules; a year-like
value can itself be a valid code. Two distinct labelled codes remain ambiguous.

A generic code label followed by explicit request-audit wording, such as “This code
was requested from”, does not introduce an OTP value. Dates and other audit numbers
therefore do not compete with a labelled verification code elsewhere in the email.
Additional actual code labels still participate in ambiguity. These grammatical hints
are generic matching heuristics and never establish sender/destination trust.

Parser reliability scope 1 treats explicit audit/reference headings as code-context
boundaries, including flattened text. A standalone reference number cannot inherit
an earlier OTP label across that boundary. Clearly negated number-free safety
statements are excluded from purpose matching; numeric disclaimers remain conservative.
Additional actual code labels and disagreement across MIME alternatives still refuse.
See [parser acceptance](generic-parser-reliability-acceptance.md).

An uncertain native OTP field can request a separate explicit email intent from the
extension popup. No Gmail message search starts before that intent. The volatile,
one-use intent expires after 30 seconds and binds to the account session, mailbox,
foreground tab, browser document and exact field group. Known authenticator,
sensitive and oversized contexts refuse this fallback. A found generic candidate
still requires a separate Fill click; intent never authorizes code release.
Unrelated navigation/sidebar/footer text is excluded from detection context only
when that region does not contain the target fields.

Generic user-confirmed code matching supports 4–8 ASCII letters/digits with exact
case preserved. Letter-containing codes require clear inline or standalone code
placement. Arbitrary words, symbols, URLs and long token fragments are not searched
as codes. The release schema and generic candidate gate accept the same bounded
format; the reviewed automatic policy is unchanged. Insertion checks number inputs
and HTML patterns before any writes and repeats compatibility checks during events.

Exactly `AAA-BBB` presentation grouping is supported in generic code context:
three ASCII alphanumeric characters, one ASCII hyphen, then three characters.
Extraction returns the six characters with case preserved. This fills six code
cells without writing the display separator. Arbitrary punctuation is not stripped.

English code connector casing is ignored, with code casing preserved. Alphabetic
quote wrappers must match. Unquoted introductory/status words are ambiguous prose,
while explicit quoted or isolated word codes remain eligible. Numeric matching
rejects partial values attached to Unicode words, URLs, addresses or domains. A
generated synthetic format matrix is part of the default unit/integration suite.

The popup treats Fill command acceptance separately from insertion acknowledgement.
It immediately disables Fill during a handoff, ignores stale READY responses for
that clicked request, renders selected-code transitional states and shows insertion
success only on FILLED. A lost command response leaves delivery unconfirmed; it
never initiates a repeat fill. The clicked request ID stays only in popup memory.

Supported automatic email-code detection starts a presentation-only popup attempt
in parallel with provider admission. The worker validates foreground browser metadata,
permission/settings/block policy and cancellation, and deduplicates early attempts
by document/URL/field group in memory. Presentation failure leaves all retrieval and
required-Fill gates intact. Manual Retry and uncertain-field recovery remain manual.

The release ledger returns closed local reservation diagnostics while retaining its
boolean compatibility API and unchanged write-ahead protection. Reused-email and
unavailable-record refusals remain UNKNOWN/message-binding and block release, but
carry an optional replay enum for precise popup recovery text. The diagnostic is
not sender trust, server-login evidence or permission to clear reservation history.

Trusted nearby new-code controls recognize request/get/send/email new/another code
wording as well as resend/send-again. They establish the existing fresh receipt
window and cancel prior approval, without any site mapping or release permission.
Script clicks and genuinely competing new messages remain refusing cases.
