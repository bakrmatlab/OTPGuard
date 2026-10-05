# Threat model and audit disposition

Assets are provider credentials, email/code material, authorization bindings, local blocks,
installation ownership and sensitive activity metadata. Email, page text, DOM inputs and
runtime message claims are untrusted. Browser metadata supplies document context but cannot
prove the website's server-side challenge or email sender. This is a bounded prototype audit,
not a guarantee that no vulnerabilities exist.

| Threat                                                     | Control and evidence                                                                                 | Remaining limit                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Spoofed From or forged Authentication-Results/Received/ARC | Gmail evidence always UNKNOWN; forged/duplicate/import tests                                         | Receiver and SMTP receipt provenance unresolved; real registry empty            |
| Lookalike, subdomain, port or frame steals code            | Exact canonical HTTPS origins and browser-bound top-level document; policy tests                     | No real site integration; approved compromised site can read inserted value     |
| Stale/ambiguous challenge                                  | Complete plausible sets, freshness/deadline caps, competing-request refusal; parser/policy tests     | No proof of server transaction identity; no newest-message shortcut             |
| Navigation/account/field change during await               | Fresh context/session/mailbox/settings rechecks and cancellation; coordinator/Chromium tests         | Async browser races cannot be claimed instantaneous; no live acceptance         |
| Worker restart/replay                                      | Volatile requests/approvals discarded; actual synthetic worker-stop test                             | Durable real successful-message dedup remains a release prerequisite            |
| Page invokes provider/storage actions                      | Exact popup sender, closed schemas, TRUSTED_CONTEXTS storage; worker tests                           | Browser/device compromise outside boundary                                      |
| Token/body leak through redirect/storage/logs              | Fixed endpoints, header/POST credentials, no cache/referrer/cookies, bounded streams and enums       | Live provider/CSP/SDK/network behavior unverified                               |
| Cross-owner cloud access                                   | Identity-derived owner, immutable installation owner, strict validators; actual offline Convex tests | Live issuer/signature/audience/revocation/two-device tests unavailable          |
| Metadata becomes undisclosed cloud history                 | Independent consent, false client/server policy gates, no active transport                           | Google derived-data classification/assessment and physical retention unresolved |
| Untrusted build input or dev source exposure               | Supported hot reload disabled; build only reviewed inputs                                            | Open vendor advisories require coherent toolchain remediation                   |

## Integrated repairs through PR15

- **High account-boundary/availability:** unbound Gmail disconnect could revoke an arbitrary
  Chrome-selected account. Now no remembered mailbox means no token/profile/revoke attempt;
  local cache cleanup and unconfirmed revocation are explicit. Regression covers restart,
  failed/pending Connect and known/changed mailbox behavior.
- **Medium latent authorization lifecycle:** disposed coordinator could restart retrieval from
  a retained reference or pending context read. Terminal checks before/after the await now
  refuse new work; disposal is idempotent and late reads cannot release.
- **Low availability:** profile JSON previously lacked an upstream allocation cap. Declared
  and streamed overflow now cancel/reject above 16KiB before parsing.
- **Earlier medium lifecycle:** settings sync disposal is terminal; stale reads/re-enable
  cannot resurrect a transport after teardown.
- **Dependency remediation:** PR15 recorded 19 advisories. Removing Plasmo/Parcel and its
  dependency tree now yields a zero-advisory locked audit and a 2.56 MB explicit Bun MV3
  artifact. No dev server is supplied; use build/reload. The worker retains the supported
  Clerk client and strict account gates. Next resolves sharp 0.35.5. Audit results are a
  time-specific dependency check, not proof of runtime or live-provider security.
  [Validation and residual limits](toolchain-remediation.md).

Reproduce with `bun run check`, `bun run check:convex` and `bun run test:browser` after builds,
plus `bun audit --json` for current vendor status. Tests use fabricated responses and local
backend runtime. Synthetic success/refusal and network guards are evidence for those artifacts,
not live OAuth, sender trust, JWT verification or public-release acceptance.

No supported-service claim, verification override, token bridge, empty issuer or cloud-policy
bypass is an acceptable demo repair. Preserve disabled gates until separately reviewed proof.
[Release readiness](release-readiness.md) enumerates the remaining work.

## Domain-authentication revision

Shared website identity intentionally becomes extension authority (owner-approved
ADR0016). Website account replacement can replace the extension account; fresh session/
user bindings invalidate prior work. Exact Frontend API cookie permission, no-cache
worker SDK, session.reload and fresh tokens reduce stale authority. Public manifests
have a stable reviewed extension ID; provider allowed_origins must preserve unrelated
valid entries and include only the exact extension origin. Web middleware restricts
accepted authorized parties to https://otpguard.net.

The optional Convex subject probe is read-only, argument-free and authenticated; its
transport uses a bounded response, timeout/abort, no redirects/cookies/referrers and
header-only JWT. Subject mismatch, revocation, account/session switch, expiry and late
logout results refuse local acceptance. A signed JWT may remain valid until expiry;
client rechecks do not create instant server revocation. Failed logout reports failure
and locally suspends authority until successful retry; restart cannot guarantee remote
revocation. No development issuer exception or privileged session creation is introduced.

Remaining high-impact acceptance gate: actual production Chromium website-to-extension
login/logout and URL audit are unverified. The SDK's production header path alone does
not prove the earlier Origin/Authorization blocker resolved. Domain verification,
Google callback behavior and live Convex issuer/JWT validation need the approved setup
in [domain-auth.md](domain-auth.md). Sender/receipt/real-fill gates remain mandatory.

## October 4 acceptance update

Basic owner email verification, shared website/extension identity, fresh production
Convex subject, extension logout and reverse website logout passed in regular Chrome;
see [final live report](domain-auth-acceptance.md). Earlier unverified login/deployment
statements above are historical. Remote revoke/switch/natural expiry/active restart,
real latency races and full credential URL/storage/network acceptance remain unverified.
The [production plan](production-readiness-plan.md) separates those gates from mock
coverage and defines required end-to-end release evidence. No real fill/sender trust
or cloud transport is enabled by these authentication results.

## Core 1 authenticated mailbox boundary

Popup Gmail Connect/Check now require fresh worker-owned Clerk authorization and a
post-Google binding recheck. Logout/expiry/cookie invalidation cancels pending Gmail
work; a selected user/session replacement cannot inherit the remembered mailbox.
Disconnect remains available for cleanup without Clerk availability. Fresh workers
never restore a cached Google grant implicitly. Tokens and both identity bindings
remain worker/Chrome-owned; no new backend, content or persistent token path is added.

The same-project provider grant is not isolated by creating a new client ID. Google
may reuse existing authorization, and revoke invalidates all project clients/scopes
for that Google account. Popup disclosure and confirmation prevent an unexplained
cross-client disconnect; live revocation is intentionally unverified because the old
grant must be preserved. A future isolated-project decision needs separate approval.
Synthetic controller/adapter checks and basic actual Chrome connection evidence are
separate from the remaining live privacy/denial/revoke/switch/expiry acceptance.
See [ADR0017](adr/0017-authenticated-gmail-connection.md).

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

## Core 3 revised pilot contract

The owner selected signer/content authentication and user-clicked release. Production
Canva pilot evidence carries delivery=unverified; it does not fabricate direct receipt.
Google HTTPS DNS/upstream resolution is now an explicit key trust dependency; current
AD=false is not called DNSSEC authentication. Forged receiver headers still grant no
trust. Signed time, exact recipient/sender, auxiliary internalDate and current request
windows bound freshness. Write-ahead local hashed message bindings refuse uncertain
send/ack replay; unseen intact copies/different message IDs/installations remain a
residual risk. Plain text is authoritative; HTML-only messages are unsupported.
[ADR0020](adr/0020-core-3-signed-content-clicked-fill.md) details these limits. Fresh real
fill/login and live crash/permission/privacy acceptance remain unverified.

## Core 4 remembered connection and late challenges

Stored connection-intent digests grant no authority by themselves. Restoration freshly
checks the same Clerk user/session, noninteractive readonly Chrome grant and Gmail
profile before CONNECTED is visible. Scope/grant/storage failure and account/mailbox
changes refuse; Disconnect removes intent before cleanup and cancels pending restoration.
No request/code/approval is restored, and write-ahead message replay limits are unchanged.
DOM mutations can trigger throttled bounded detection after the original one-minute
window; per-field deduplication, current context and policy remain mandatory. The final
current-check still obtains a fresh authoritative account result after browser checks.
Synthetic regressions passed; full owner-profile lifecycle/privacy coverage remains
unverified. See [ADR0021](adr/0021-core-4-remembered-mailbox-and-late-challenges.md).
