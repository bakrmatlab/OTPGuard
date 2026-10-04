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
- **Open dependency gate:** PR15 audit recorded 19 advisories: 8 high, 10 moderate, 1 low.
  Affected tool families include Parcel dev server, braces, browserslist, CSP parser, esbuild,
  fflate, HTTP cache semantics, msgpackr, sharp, Svelte and tsup. Reachability review found
  primarily build/tooling paths, which is not proof of runtime safety. Next image dependency
  resolution also needs verification before deployment/image processing. No compatible
  automatic fix was established. Raw `plasmo dev` bypasses the disabled entry and is unsafe.
  [Parcel advisory](https://github.com/advisories/GHSA-qm9p-f9j5-w83w) documents source exposure.

Reproduce with `bun run check`, `bun run check:convex` and `bun run test:browser` after builds,
plus `bun audit --json` for current vendor status. Tests use fabricated responses and local
backend runtime. Synthetic success/refusal and network guards are evidence for those artifacts,
not live OAuth, sender trust, JWT verification or public-release acceptance.

No supported-service claim, verification override, token bridge, empty issuer or cloud-policy
bypass is an acceptable demo repair. Preserve disabled gates until separately reviewed proof.
[Release readiness](release-readiness.md) enumerates the remaining work.
