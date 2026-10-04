# Full application deployment review

Reviewed October 3, 2026 (America/Toronto), source commit
`3e6334edb3e0e093dfd5ff13d6ed4c5da6670233`, local branch
`codex/full-app-deployment-review`. This owner-selected review follows PR16;
the numbered implementation plan ends at16. No new numbered specification is assumed.

**The connected OTPGuard product is not ready for deployment or public extension
distribution. Required work remains.** The credential-free web presentation and
separate synthetic extension are locally reproducible portfolio artifacts. Hosting
that web presentation is a smaller, separately authorized operation; it would not
activate or demonstrate a connected security product.

This is the baseline review at the commit above. The subsequent [toolchain remediation](toolchain-remediation.md)
closes the dependency and excessive artifact-size findings and reconciles local plan status.
The subsequent [local release completion](local-release-readiness.md) adds verified standalone
archives, fresh registry installation and extracted-package checks. Statements below about
unverified standalone output and registry bootstrap describe the baseline, not current local
readiness. The connected-product blockers and live acceptance gaps remain.

## Deployment dispositions

| Target                                     | Disposition                                                                | What remains                                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local portfolio web and synthetic demo     | Local acceptance passed                                                    | Actual toolbar interaction, assistive-technology speech, new-machine network bootstrap and Linux remain unverified                                                                                                         |
| Credential-free portfolio web hosting      | Candidate for a separate hosting scope; not deployed or accepted on a host | Select host/runtime, reproduce web-only dependency install/build, keep provider variables absent, validate HTTPS routes/assets/mobile/keyboard behavior and no provider traffic, decide operational ownership and rollback |
| Connected production web/extension/backend | Blocked and incomplete                                                     | Resolve authentication and mail evidence; implement active site/transport/manual-fill integration; satisfy controlled live acceptance                                                                                      |
| Chrome Web Store extension                 | Blocked                                                                    | Connected-product evidence, dependency/package review, final version/listing/privacy/permissions and applicable provider/store reviews                                                                                     |

A normal Next server build exists; portable standalone/static export and hosted routing
have not been accepted. The synthetic extension uses fabricated sender evidence and
loopback fixtures and must remain separate from production distribution.

## Standards review

No new confirmed security-invariant violation was established in the reviewed entry
points. These readiness findings remain open; contained does not mean repaired.

| ID / severity                          | Evidence                                                                                                                                                | Disposition and required action                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 / High dependency release gate      | Fresh `bun audit --json` exits1:19 advisories,8 high/10 moderate/1 low. Plasmo0.90.5 retains affected build/tooling dependencies                        | Open. Scope coherent upgrade/removal, assess each dependency's actual reachable use, rerun artifact/security/browser regressions. Preserve disabled hot reload; raw Plasmo dev bypasses containment                     |
| S2 / Medium packaging/performance gate | Static Clerk import in `apps/extension/account/worker.ts:1`; fresh default artifact312,398,760 bytes/73 files, including numerous large Clerk UI chunks | Open. Investigate unnecessary assets/import boundaries, establish measured size/startup/memory budgets, test worker/popup cold load and update cost. Local load does not establish store/package performance acceptance |
| S3 / Low local planning drift          | Ignored implementation plan still has historical PR15 pending/PR16 unstarted status despite integrated commits                                          | Open local maintenance. Reconcile status separately; never force-add ignored planning records or link them from public docs                                                                                             |

Read-only resolution confirmed Next uses and loads `sharp0.35.5`, matching its requested
`^0.35.4`. The older vulnerable Plasmo copy must not be described as the current Next
image runtime. Hosted image-processing acceptance remains unverified. Audit families:
Parcel dev server, braces, browserslist, CSP parser, esbuild, fflate, HTTP cache semantics,
msgpackr, sharp, Svelte and tsup. An advisory count alone is not exploitability proof;
primarily tooling exposure is not proof that a public release is safe.

The reviewed build finalizer rejects content scripts, web-accessible resources and
external messaging. Default manifest is MV3/storage only, no hosts/OAuth/key/site access,
`script-src 'self'; object-src 'none'; connect-src 'none'`. Optional Gmail/Clerk
permissions and CSP are exact configuration gates. CI pins tool versions, builds before
artifact-sensitive tests and has no publishing step. Public documents accurately state
the capability limits and their relative links resolve.

## Spec review

| ID / severity                       | Requirement and source evidence                                                                                                                                                                              | Disposition and required action                                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 / High product blocker           | Design requires two or three validated real email-code flows. `packages/security/index.ts:23` ships an empty registry; `packages/security/gmail.ts` always yields UNKNOWN sender/unverified receipt          | Intentional safety gate. Establish justified receiver and SMTP receipt provenance against forged/duplicate/imported mail; validate sanitized real templates, exact origins, purpose and formats before adding coverage                                            |
| P2 / High product blocker           | Design requires connected auto/manual fill and retry. `apps/extension/background.ts:5` is popup-only, production content entry is0 bytes; popup fill/retry/site enablement/dashboard navigation are disabled | Intentional partial implementation. After prerequisites, implement reviewed optional site permissions/registration, browser-derived request adapters, real retrieval/envelopes, manual action/retry and safe restart/message-use deduplication                    |
| P3 / High authentication blocker    | Connected requests require fresh independent Clerk identity. `apps/extension/account/config.ts` refuses `pk_test`; worker uses explicit no-cache/fresh probes                                                | Intentional gate. Establish a supported URL-free authoritative transport. Existing development configuration is insufficient; provider setup alone is not acceptance. Keep worker-only credentials, fresh session/account cancellation and no-cache behavior      |
| P4 / Medium connected dashboard gap | Design requires authenticated metadata sync. `apps/web/app/dashboard.tsx` is presentation-only; settings/activity controllers have no active transport; Convex has no accepted live deployment               | Incomplete. Implement bound minimal-claim JWT/header transport, deployment/issuer validation, dashboard subscriptions and honest error/loading/stale states; test cross-owner/two-device/account transitions live                                                 |
| P5 / Medium optional history gate   | Client/server cloud-history policy remains false; Convex append/opt-in rejects policy-unresolved operations                                                                                                  | Intentional gate. Keep upload disabled unless derived-data eligibility/verification/assessment, informed consent, processor and retention/deletion/backup controls are reviewed. Production may retain local-only history if cloud history is explicitly deferred |

These are documented partial acceptance findings, not newly introduced runtime defects.
Synthetic trust or configuration changes cannot close sender/authentication gates.
No copy/reveal/override or protection-off shortcut is acceptable.

## Boundary coverage and acceptance gaps

| Reviewed area                      | Current evidence                                                                                                                                                        | Missing release evidence                                                                                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure parser/security/MIME packages | Leading zeros, conservative templates, ambiguity, exact HTTPS origins, bounded inert normalization, forged-header refusal tested                                        | Actual sanitized supported mail/template provenance, receipt/authentication boundary, real parser/input compatibility                                                                                                  |
| Background/popup/content           | Exact popup sender/closed schemas, local settings/history, disabled connected actions; default Chromium load and persistence checks                                     | Actual toolbar, Chrome compatibility, controlled connected UX and speech testing                                                                                                                                       |
| Detection/insertion/coordinator    | Separate synthetic/browser fixtures cover typing, replacement, foreground/navigation, ambiguity, single/split/native events, cancellation/restart                       | Real supported-site browser adapter/injection, current account/document rechecks, durable successful-message reuse refusal, bounded quota/offline/manual-retry behavior                                                |
| Gmail lifecycle/transport          | Worker-only token operations; fixed endpoints, header/POST credentials, no cache/cookies/redirects/referrer,10-second signals, profile/list16KiB/full512KiB stream caps | Controlled consent/denial/revoke/switch/expiry/network/CSP acceptance. Unbound disconnect performs local cleanup and reports remote revoke unconfirmed. Historical owner reports are not independent live verification |
| Web authentication                 | Production-key server gate and conditional Clerk provider/proxy/sign-in; unconfigured UI builds                                                                         | Compatible production web/extension identity, cookie/CSP/logout/expiry/switch acceptance; no secret/session in URLs or app storage                                                                                     |
| Backend/settings/activity          | Actual offline schema/function ownership, immutable installation ownership, retention/export/delete tests; auth provider absent by default, policy gates false          | Deployed issuer/signature/audience/JWT validation, live transport, two devices, scheduler execution, physical deletion and backups, recovery/account/device lifecycle decisions                                        |
| Privacy/storage/network            | Closed settings/history DTOs; trusted-context local storage; codes/mail/tokens excluded from backend/history. Default dashboard/popup network guards tested             | Final provider SDK/network/storage/log audit under controlled authorized live use; processor/log/backup behavior on selected host                                                                                      |
| Build/package/CI/docs              | Fresh locked cached setup/build/check/browser passes; no fixture entry in default manifest; self-contained public documentation                                         | Fresh network bootstrap/Linux/hosted CI acceptance, distribution artifact provenance/version/license decision/support/privacy contact, updates/rollback                                                                |

No personal Chrome profile, mailbox, provider CLI login/configuration or credentials were
used. Existing provider env files and `apps/extension/build` were not changed; validation
built an isolated Git export. The only env example in that export was tracked `.env.example`.
The owner server on3000 was left untouched; tests used3100/3001 and disposable Chromium.

## Exact checks in this review

Commands ran against the provider-free `/tmp/otpguard-readiness-review` export unless
stated otherwise, with `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`,
Node22.19.0/Bun1.4.2. Temporary paths are local evidence, not durable release assets.

| Command/check                                                                                | Result                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch`, `git log -3 --oneline`, `git remote -v`, `git rev-parse HEAD` | Passed: clean main tracking origin/main at3e6334e before local review branch creation                                  |
| `git archive HEAD` into temporary export                                                     | Passed; no provider env files copied                                                                                   |
| Initial build using root-only node_modules symlink                                           | Failed missing workspace Next/Plasmo executables; replaced with proper locked install; not counted as build acceptance |
| `bun install --frozen-lockfile --offline`                                                    | Restricted attempt failed tempdir EPERM; local escalated cached install passed. No new-machine/network-bootstrap claim |
| `NEXT_TELEMETRY_DISABLED=1 PLASMO_TELEMETRY_DISABLED=1 bun run build`                        | Passed current-source Next and default Plasmo builds                                                                   |
| `bun run build:mock`                                                                         | Passed separate synthetic artifact                                                                                     |
| `bun run check`                                                                              | Passed types/lint/format and283 tests/19files                                                                          |
| `bun run check:convex`                                                                       | Passed backend types and16 actual offline tests/2files                                                                 |
| `bun run test:browser`                                                                       | Passed29 cases;1 configured-only case skipped by default configuration                                                 |
| `bun audit --json`                                                                           | Restricted DNS attempt failed; public-registry retry failed audit with19 advisories (8high/10moderate/1low)            |
| Fresh manifest/file inspection                                                               | Passed storage-only/no-network/no-injection default boundary;312,398,760 bytes/73 files; production content0 bytes     |
| Public relative Markdown link check                                                          | Passed all public files including this report; formatting and git diff whitespace checks passed                        |

PR16's ZIP extraction/load and clean reproduction are prior evidence from identical source,
not a newly repeated ZIP acceptance here. Configured Gmail artifact/live provider tests,
new network install, Linux, hosted CI/deployment, speech and store/provider reviews remain
unverified. Neither offline Convex mocks nor synthetic Gmail fetch/identity doubles validate
deployed cryptography or real grants.

## Concrete remaining scopes

1. Select whether the immediate deliverable is only hosted portfolio web or a connected
   product. For portfolio hosting, scope a credential-free web-only build/host smoke test,
   current web dependency review, accurate disclosures and operational rollback.
2. Resolve mail receiver/receipt provenance and supported real fixtures first. If a defensible
   boundary is unavailable, revisit product feasibility rather than weakening authorization.
3. Establish compatible account transport and controlled Gmail lifecycle evidence, with
   separately authorized provider configuration and test accounts.
4. Implement real browser/site/manual/retry/restart integration only after those gates;
   demonstrate genuine supported success and adversarial refusal plus privacy/cancellation.
5. Complete settings/device/dashboard transport and deployed backend acceptance. Decide
   whether optional cloud activity remains deferred; it need not be enabled to ship a
   explicitly local-history product, but any claimed cloud functionality needs policy/live proof.
6. Remediate/review dependency exposure and excessive extension assets; validate final
   performance/compatibility, package provenance and clean Linux/host CI reproduction.
7. Finish public distribution obligations: operator/contact/privacy/support, scope and
   permission justification, applicable Google verification/assessment, store listing/review,
   version/license decision and update/rollback procedure. Revalidate the final artifact.

Substantial remediation/features require separately owner-selected scopes. This change is
report-only: no runtime/dependency/permission/gate changes, commit, merge, push, remote PR,
deployment, provisioning, paid resource or additional chat. Stop for owner review.

Standards:3 readiness findings, worst dependency release gate. Spec:5 partial/gated
requirements, worst unsupported real connected fill. The axes remain separate.
