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

| Mechanism           | Current bound                                                                           |
| ------------------- | --------------------------------------------------------------------------------------- |
| Detection           | Top-level light DOM; 60 seconds/120 scans, 2,000 elements/200 inputs; 4–8 split fields  |
| Parser              | English numeric 4–8 characters; 1,000 subject/32,768 text characters; ambiguity refuses |
| MIME normalization  | 256KiB decoded body plus inspected headers, 64 parts/depth 8; strict inert HTML subset  |
| HTTP JSON           | Profile/list 16KiB; full message 512KiB; caps enforced before JSON parsing              |
| Retrieval seam      | 20 IDs/10 distinct bodies; pagination/overflow refuses; 0/2/6/12/22-second retries      |
| Request/approval    | 60-second request; at most 30-second approval; provider operations 10 seconds           |
| Local/cloud history | 7/30-day logical retention; 500 records; cloud currently disabled                       |

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
immediately outside that queue. Cleanup can run without Clerk. No binding survives worker restart and no token reaches
popup/content/backend. The reviewed stable-ID artifact requests only Gmail readonly,
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
