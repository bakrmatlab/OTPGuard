# Architecture and current decisions

The shipped entry points and the synthetic demonstration have different capabilities.

```text
Production popup -> exact worker actions -> Chrome local settings/history
                         |
                         +-> optional Chrome identity -> Google profile/revoke

Production web -> unconfigured account/security dashboard
Convex functions/schema -> offline ownership/retention tests (no active app transport)

Separate native auth development prototype:
extension-owned page -> memory-only worker -> Clerk native FAPI header transport
                     -> fresh convex-template token -> read-only Convex identity probe

Separate synthetic extension:
loopback field -> worker browser context -> fabricated mail -> pure parser/policy
              -> bound prepare/recheck -> document-targeted release -> live empty field
```

The owner-approved independent-session model and explicitly deployed development backend
are described in [the native auth scope](native-auth-prototype.md). This separate artifact
does not activate production/dashboard sync, Gmail retrieval or real autofill.

The extension is built with explicit Bun browser entries: background worker and React
popup. Only the seven legacy `PLASMO_PUBLIC_*` settings are embedded, preserving existing
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
