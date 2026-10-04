# Production readiness and revised delivery plan

Assessment: October 4, 2026, America/Toronto. Baseline main:
`acf27313b2dc57a046ff4cacb98c06dc372a68c6` (merged GitHub PR #4).
Status: proposed for owner review; no implementation, provider mutation, publication,
merge or deployment is authorized by this plan. Historical PR numbers 1–16 remain
historical milestones; use R1–R11 below for new plan scopes, not GitHub issue numbers.

## Superseded execution sequence — October 4 owner revision

The owner selected **core first, polish afterward**. Use
[the current core PR plan](core-implementation-plan.md) for execution: Core 1–4,
then polish/release. R1–R11 below is preserved as historical audit decomposition;
it is not the active backlog. The evidence ledger and detailed acceptance matrix
remain reference material. Basic production Google login/shared extension/Convex
acceptance now passed; see [Google report](google-login-acceptance.md). Earlier
Google-disabled statements describe the assessment baseline.

## Decision and production definition

OTPGuard is a deployed account-authentication prototype with a separately demonstrable
synthetic OTP pipeline. It is **not yet a functioning real-mail OTP product**. The most
important remaining issue is feasibility: Gmail API headers and timestamps do not yet
establish the sender/receipt provenance required by the security contract. More UI,
keys or deployment cannot resolve that boundary. If R2 cannot establish it, stop the
real-fill track and bring an explicit architecture/product decision to the owner.
Never replace the gate with From matching, header position, a copied pass string,
newest-mail selection, parser score or a manual verification override.

Proposed release stages:

1. **A: hosted account prototype.** Email signup/login, shared same-profile extension
   login/logout and authenticated identity probe; unsupported Gmail/fill/sync clearly
   disclosed. Existing basic owner checks pass; R1 and applicable R8/R9 release gates
   remain before calling this an accepted release. No Google sign-in promise.
2. **B: controlled end-to-end pilot.** Authorized test users/mailboxes and a final
   configured extension; at least one validated direct real-mail flow proves the
   mechanism, followed by two or three approved flows for the design's MVP. R2–R5,
   R1 and pilot privacy/security checks must pass. Appropriate Google testing or other
   distribution conditions must be documented; a pilot is not a verification exemption.
3. **C: public local-history OTP MVP.** Two or three named, validated flows; safe
   automatic and verified manual fill/retry; optional site permission; local history;
   R1–R5 and R8–R9 fully accepted with applicable Google/Chrome approvals. Cloud
   history stays disabled. R6 is required only if cloud settings/device dashboard
   functionality is advertised; an auth-only dashboard must disclose its limits.
4. **D: optional connected dashboard/history.** R6 for settings/devices, R10 for
   cloud history after policy review. R11 Google social login is independent and
   optional at every stage. Neither is needed to prove local real OTP functionality.

A production success means the owner initiates a supported site's email challenge,
consents to local Gmail access and site access, and the intended code reaches the
current field once, with leading zeros preserved, while every refusal/cancellation
case below releases no code. The owner may complete submission and confirm the site's
success directly; a DOM acknowledgment alone is not server login acceptance. No live
mail/code/Gmail credential may reach OTPGuard servers, persistent app storage, logs,
URLs, telemetry or evidence artifacts. Supported scope remains top-level HTTPS Chrome,
one mailbox, numeric single/split fields, no extension-initiated submission.

## Evidence ledger and actual gaps

Labels: **mock** means fabricated providers/data; **gated** means implemented seams
not active in production; **live** means specifically observed provider/browser behavior;
**unverified** means required evidence is absent. A merged milestone is not full acceptance.

| Area                                               | Actual evidence at baseline                                                                                                                                                                           | Remaining gap / priority                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Detection, insertion, parser, policy, cancellation | Mock fixture/browser and pure tests; production `content.ts` is empty                                                                                                                                 | Active browser adapter, site permission lifecycle and real input compatibility; P0 before fill                                               |
| Real services and sender/receipt                   | `packages/security/index.ts` exports empty registry; normalization refuses trusted evidence; ADR0009 and PR9 research unresolved                                                                      | Justify receiver boundary and direct SMTP receipt, then sanitized real templates; P0 feasibility                                             |
| Gmail                                              | Worker lifecycle, bounded transport/retrieval and composed coordinator are gated; background accepts popup lifecycle messages only                                                                    | Current client registration/stable ID, controlled real consent/revoke/account selection, active retrieval adapter; P0                        |
| Clerk                                              | Worker uses no app credential cache, authoritative reload, fresh token and selected `Session.remove()`; domain acceptance records live email verification, shared identity and both logout directions | Remote revoke/switch/expiry/restart/real latency and full credential/network/storage audit; P0 connected authority                           |
| Convex identity                                    | Production deployment and fresh same-account probe observed; anonymous refusal observed                                                                                                               | Live two-owner negative JWT/ownership tests and metadata operations unverified; a subject probe does not accept all functions                |
| Settings/devices/dashboard                         | Backend functions and offline ownership tests exist; local preferences work; worker returns `UNCONFIGURED`; web renders static unconfigured device/activity states                                    | Actual extension/web transport, two-device conflicts, account-switch installation ownership, device/account deletion; P1 or explicitly defer |
| History                                            | Profile-local contracts/retention/export/delete implemented; no production fill events; cloud policy function always false                                                                            | Wire real local events; policy, consent, processors/backups and live deletion/cleanup before cloud activation; P1 local / optional cloud     |
| Packaging/dependencies                             | Explicit Bun builder replaced Plasmo; credential-free package/extraction checks and prior zero-advisory audit; CI passed on baseline main                                                             | Configured release artifact, store ID/key compatibility, version/license, final audit/Chrome/accessibility/update checks; P0 public release  |
| Operations                                         | Domain and production auth/backend established; website deployment is READY                                                                                                                           | Deployment drift, explicit promotion/rollback, health/incident/security ownership and safe diagnostics; P0 release                           |

### Evidence inspected in this assessment

- Clean local main and actual Git history at baseline; code in background/content,
  account worker/probe, Gmail coordinator, build script, settings/history worker,
  dashboard, security registry, Convex sync/activity/auth and CI.
- Read HANDOFF, workflow, complete design/review/implementation plan; PR9 sender and
  PR12 policy research; domain-auth acceptance, deployment and local release reports;
  privacy/threat notes. Historic reports are dated evidence, not fresh live checks.
- Read-only GitHub: PR #4 is MERGED at baseline; main Foundation checks completed
  successfully, as did both final branch runs at `319b9b4`. Earlier runs at `6366ae5`
  failed; retain that history. PR #3 is OPEN/DRAFT on `codex/independent-native-auth`.
  Recommend owner close it as superseded, preserving ADR0015 and browser failure
  research; do not merge or port its custom transport. No PR state changed here.
- Read-only Vercel project: `otpguard`, root `apps/web`, Node `22.x`,
  `commandForIgnoringBuildStep: "exit 0"`, `autoAssignCustomDomains: false`.
  Source `apps/web/vercel.json` also disables Git deployment. These independent gates
  require a deliberate release decision; passing CI does not update production.
- Read-only alias lookup: `otpguard.net` targets `dpl_FWAXBdMAAmNvt9qPF5pjgyAra7aN`;
  deployment readback is READY/production. Recorded source is `5edffca` in the deployment
  acceptance report; current API `gitSource` and commit metadata are null, so source
  provenance cannot be independently reconstructed from that readback. Main contains
  later logout repair/docs. Worker repair is shipped in the owner's temporary auth
  build; the website did not thereby redeploy. Record per-component hashes in R8.
- Cloudflare DNS/TLS, Clerk instance/origin/native API/JWT template, Vercel secret
  configuration and Convex issuer/deployment are prior authorized setup evidence in
  domain-auth acceptance and the handoff, not freshly re-audited in this assessment.
  Google social provider was disabled for absent credentials. No secret values read,
  printed or copied; no live mailbox/profile or credential entry attempted.
- Reopened primary Google Message/scopes/restricted-verification documents. Message
  contract still supplies header strings and migration-sensitive `internalDate`;
  inference: these alone do not resolve the required provenance. `gmail.readonly`
  remains restricted. Verification/assessment applicability must be determined for
  the actual distribution and data flows, not inferred from local processing.
  [Message contract](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages),
  [scope classification](https://developers.google.com/workspace/gmail/api/auth/scopes),
  [verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

## Prioritized PR sequence

Each row is one owner-selected review scope with its own `codex/` branch. External
actions require their specific authorization. Keep live provider checks separate from
synthetic CI; report achieved/failed/unverified criteria and stop after each PR.

### R1 — Complete production account lifecycle acceptance (P0)

Title: `test(auth): accept production shared-session lifecycle`.
Depends on merged #4. Reproduce current final artifact and owner-controlled email flow;
verify admin revocation, account switch, natural expiry, active worker restart, offline
reload and delayed probe/logout. Repair concrete failures within this scope, with
regressions. Audit Clerk/Convex request URLs, headers, redirects, cookies and app
storage without saving raw secrets. Document browser-owned session cookies separately
from forbidden app JWT cache. Check exact issuer/audience and failure behavior.
Acceptance: A01–A06 below; no authority after invalidation, fixed errors, bounded offline
failure, no JWT in URLs/app storage, no stale successful probe after a switch. Revocation
is checked at authoritative boundaries; do not promise instant revocation of issued JWTs.
Output: sanitized report and final artifact/source ID; owner credentials entered directly.

### R2 — Decide trusted mail feasibility (P0; critical path)

Title: `docs(security): resolve Gmail sender and receipt feasibility`.
No dependency on R1. Review primary provider guarantees and candidate alternatives;
obtain explicitly authorized controlled direct SMTP and adversarial import/insert/
forward/duplicate evidence where possible. Do not send test attacks outside controlled
resources. Timebox initial work to one review scope: deliver either a justified evidence
contract and ADR with precise limits, or a documented unresolved outcome and product
alternatives for owner decision. Experiments alone cannot prove a universal stripping
or provenance guarantee. Local DKIM verification, if proposed, must address raw-byte
integrity, signed From/template material, replay/freshness and import limitations; it
is not assumed sufficient. Server mail ingestion would change the local-first contract
and cannot be silently substituted.
Acceptance: S01–S03; no asserted trusted header solely from name/position/value, no
sender-controlled receipt accepted. If unresolved, keep UNKNOWN/empty registry and
stop dependent real fill; stages A and mock demo remain viable.

### R3 — Accept Gmail OAuth and distribution feasibility (P0)

Title: `feat(gmail): validate stable production mailbox connection`.
Depends on R1 for combined auth acceptance, but provider preparation can precede R2.
Inventory current Google project/client/consent configuration read-only; reconcile
public key, auth ID `jfncecbkgdnhdppgpblbokkceflpmgif`, OAuth registration and future
store ID before replacing the preserved Gmail build. Builder currently rejects combined
account/Gmail IDs that differ. Confirm Gmail API, minimum scope, explicit Connect,
actual account-selection limitations and worker restart reconnect semantics. Request
provider configuration only after exact changes are reviewable. Establish application's
permitted use and verification/assessment path early, including derived provider status.
Acceptance: G01–G04, combined build loads with exact ID/narrow permissions; no surprise
consent; revoke failure distinguished from local cleanup; no tokens leave worker/Chrome
cache. Deliver verified provider facts and exact remaining external approval tasks.

### R4 — Validate and ship initial real service rules (P0)

Title: `feat(security): add validated email-code service coverage`.
Depends on accepted R2 and mailbox access from R3. Owner selects two or three actual
flows with controlled accounts. Collect originals locally, sanitize codes/identifiers
before committing; document how sanitization invalidates DKIM bytes. Add exact origins,
sender/authenticated-domain mappings, template/purpose/length/freshness and dated
provenance. No assumed support for candidate brands. Validate supported single/split
site DOM/events and refusal of quoted/forwarded/ambiguous messages.
Acceptance: S01–S05 and F01–F02 for every claimed flow; all registry entries have
reviewed provenance; changed templates yield UNKNOWN. Unsupported services stay closed.

### R5 — Activate the complete local production pipeline (P0)

Title: `feat(extension): enable authorized real-mail fill`.
Depends on R1–R4. Add narrowly scoped optional site access, consent-time content
registration/removal, browser-derived sender/document adapter and composed account/
mailbox coordinator in the production worker. Keep mock entries out of production.
Wire bounded Gmail list/get, cancellation, popup status, auto preference, same-policy
manual fill and retry; record sanitized local acknowledgment events. Add minimal
short-lived account/mailbox/message dedup state and a reviewed conservative crash
policy: uncertain prior release must not replay; never persist code/body/token or upload
local message identifiers. Test crash windows before/after send/ack; fresh requests do
not automatically make a previously released message reusable.
Acceptance: F01–F10, G04–G06, P01; owner verifies real site success and adversarial refusal.
Optional host denial/revocation prevents detection/retrieval; local blocks win. No
extension submission, user-value overwrite, concurrent wrong-tab fill or retry loop.
First pilot proves one named flow; MVP acceptance covers all two or three claimed flows.

### R6 — Connect settings/device dashboard, if included (P1)

Title: `feat(sync): connect authenticated settings and device reports`.
Depends on R1/R3; full provider-report journey acceptance follows R5. Use existing
backend/controller contracts with fresh JWT transport; add real web loading/empty/error
views and two-device settings conflict policy. Specify installation identity on Clerk
account switch (immutable ownership prevents ID reuse across owners), logout, reinstall,
deregister and account deletion. Add required owner-scoped lifecycle functions and
bounded cleanup if existing functions are insufficient. No mailbox addresses or raw
blocked origins in cloud payloads. Assess Google policy for Gmail-derived status too.
Acceptance: C01–C04, P01; real A/B isolation and settings roundtrip, stale reports labeled,
local disable/blocks win, offline fill unaffected. Do not advertise remote Gmail revocation.
Can defer entirely for local-history MVP with honest dashboard states.

### R7 — Complete real connected UX/accessibility (P1)

Title: `feat(extension): finish connected protection UX`.
Depends on R5; R6 only for advertised cloud views. Exercise actual toolbar/popup,
account vs mailbox identity, site enablement, searching/no mail/reconnect/UNKNOWN/
MISMATCH/BLOCKED, manual retry and disabled auto fill. Distinguish input insertion from
server login. Remove stale setup claims; include limits of profile-local history.
Acceptance: U01–U02 and F/G statuses; keyboard and screen-reader speech verified by a
human, no reveal/copy/override path; unsupported pages receive understandable bounded states.

### R8 — Add controlled releases and operational readiness (P0 release gate)

Title: `chore(release): add reviewed promotion and recovery workflow`.
Can start after plan approval; release acceptance depends on chosen stage's PRs.
Choose explicit manual promotion or protected CI deployment, then reconcile all three
Vercel build/alias controls consistently in a separately authorized provider step.
Keep preview production secrets unavailable to untrusted forks. Pin/verify remote Bun
(version previously selected 1.4.1 vs local 1.4.2), record immutable source/config/public
artifact hashes, extension version and Convex schema compatibility. Build configured
release assets in isolated clean source; current `package:review` intentionally refuses
configured assets and is not the final product packaging path. Preserve owner env/builds.
Acceptance: O01–O04 and P01; deployment from intended reviewed commit, explicit alias
promotion, rollback rehearsal (including forward-compatible backend strategy), no secret
in asset/provenance, current audit/CI and safe health diagnostics. Define operator,
alerts for DNS/TLS/auth/backend outages, quota budgets, secret rotation, incident response
and support/deletion contact. Diagnostics use bounded enums/counts, never mail/login
host history/raw URLs/tokens; logs and provider retention need review.

### R9 — Public distribution and final release audit (P0 public gate)

Title: `docs(release): accept public extension distribution`.
Depends on R1–R5/R7/R8 and R6 if claimed. Prepare final version/license decision,
privacy/support/deletion pages, minimum permission/scope rationale, Google verification
submission evidence and required assessment or applicable documented exception; Chrome
Web Store listing/assets/review; supported browser matrix and update compatibility.
Reaudit configured ZIP/store manifest and bundles, CSP, origin permissions, network,
storage, logs, supply chain and final E2E matrix. Store-assigned ID must match Clerk/
Google registration or be deliberately migrated and retested. Submissions/publication
are separate owner-authorized actions; preparation does not establish approval.
Acceptance: all applicable matrix rows and Google/store disposition accepted; no unresolved
critical/high invariant violation; reviewer can reproduce clean install/update/refusal.

### R10 — Optional cloud history, separate later release

Title: `feat(activity): enable approved opt-in cloud history`.
Depends on R5/R6 and explicit policy acceptance for derived Gmail data. Keep false gates
until permitted-use/verification/assessment, consent and processor obligations are met.
Implement web/popup opt-in, withdrawal, export/delete and account deletion; accept actual
scheduler physical expiry, cleanup backlog, backups and retention commitments.
Acceptance: H01–H03/C02/P01; opt-out sends zero events; six-field allowlist only;
withdrawal cancels queued upload and prevents new writes; outages never block fill;
server committed-write races and deletion failures accurately reported. Not MVP-critical.

### R11 — Optional production Google account sign-in

Title: `feat(auth): configure and accept Google social sign-in`.
Depends on R1/R8; independently obtain authorized production social OAuth client and
exact callbacks for Clerk, then test redirects/session/logout/account switch and safe
failure. No Gmail scope or mailbox connection follows from social login.
Acceptance: owner live Google success/denial, callback URL credential audit and same
shared-session refusal cases as email. Keep provider disabled until configured/accepted.

Dependency path: R2 + R3 → R4; R1 + R3 + R4 → R5 → R7;
R1 + R3 → R6; selected-stage acceptance + R8 → R9;
R5 + R6 + policy approval → R10. R11 is optional. Provider review work should begin
with R3, because external latency cannot be estimated from engineering PR completion.

## Exact end-to-end acceptance matrix

All rows are currently unverified live unless stated. Synthetic passing cases are
regression evidence only. Each execution records artifact/source/config revision,
Chrome/OS, date, sanitized result, failure enum and reviewer; never account labels,
mail/raw URLs/tokens/codes, traces, screenshots or raw network dumps. Owner enters
passwords/CAPTCHA/verification directly. Do not weaken bot protection or automate CAPTCHA.
Use isolated controlled resources and a private local review for sensitive inspection.

| ID  | Setup and action                                                                                    | Required observation / gate                                                                                               | Current live status                                                 |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A01 | Website email signup/verify; open exact auth extension; run fresh subject check                     | Same selected account, authenticated server subject matches; no secret exposed                                            | Passed basic owner regular Chrome checks in domain-auth report      |
| A02 | Extension logout, website reload, popup reopen; repeat with website logout first                    | Both signed out; reopened popup requires sign-in and cannot probe                                                         | Passed final selected Session.remove and reverse logout checks      |
| A03 | Admin revoke active session; then request/probe; hold a pending reply until revoke                  | Authoritative refresh refuses; pending code/probe cannot report success                                                   | Unverified                                                          |
| A04 | Switch website A→B while request/probe pending                                                      | A authority canceled; late A response rejected; no A metadata under B                                                     | Unverified                                                          |
| A05 | Natural expiry, active worker termination/restart, then popup/request                               | Fresh remote session required; expired refuses; no old approval restored                                                  | Unverified                                                          |
| A06 | Offline/auth outage and delayed logout/probe; inspect URLs/cookies/storage privately                | Bounded refusal, failed logout suspends authority; no app JWT persistence or credential URL                               | Unverified                                                          |
| G01 | Explicit Connect and decline consent; deny/missing readonly scope                                   | No connected mailbox or retrieval; clear retry state; no surprise prompt                                                  | Unverified                                                          |
| G02 | Connect controlled mailbox; compare account identities; reconnect/reopen/restart                    | Actual mailbox shown, independent Clerk identity; documented selection; restart explicit reconnect                        | Historical owner reports only; current combined artifact unverified |
| G03 | Disconnect/revoke known mailbox; simulate revoke failure; restart before disconnect                 | Cancel work, clear local cache; confirm remote revoke only when established; unbound path no arbitrary revoke             | Unverified                                                          |
| G04 | Revoke grant/expire token or switch mailbox during profile/list/get/fill                            | One bounded noninteractive recovery or reconnect; no old mailbox code release                                             | Unverified                                                          |
| G05 | Delay mail/no mail, 429 Retry-After, 401, 5xx, network timeout                                      | Bounded 0/2/6/12/22-second schedule respecting deadline/quota; stop then explicit retry; no infinite polling              | Unverified                                                          |
| G06 | Oversized/malformed MIME/charset/base64; remote image/script HTML                                   | Caps enforced; inert parse, no remote load; safe fixed status                                                             | Unverified live; synthetic coverage exists                          |
| S01 | Valid direct real email for each claimed service; parser and sender contract                        | Exact template/code including zeros and justified aligned evidence; no template claim from invented fixture               | Unverified; zero services                                           |
| S02 | Controlled spoofed From/display name and forged/duplicate auth headers                              | UNKNOWN/refusal, code never sent to page                                                                                  | Unverified                                                          |
| S03 | Forwarded/quoted/attached/imported/inserted mail; manipulated Date/internalDate                     | Unsupported provenance refuses; fresh-looking timestamp cannot authorize                                                  | Unverified                                                          |
| S04 | Stale code, two plausible codes/messages and unsupported purpose/template                           | UNKNOWN/refusal; no newest-message ambiguity shortcut                                                                     | Unverified                                                          |
| S05 | Lookalike, wrong scheme/port/subdomain, iframe, unrelated origin                                    | No permission/injection/release; exact shipped origins only                                                               | Unverified live; synthetic coverage exists                          |
| F01 | Fresh real single-input challenge, auto on, explicit site permission                                | One correct insertion, framework sees it, owner confirms site completion; extension does not submit                       | Unverified                                                          |
| F02 | Real split-input challenge, leading zero, framework-controlled fields                               | Exact group/events; no wrong length or overwrite; owner confirms flow                                                     | Unverified                                                          |
| F03 | Disable automatic fill; then verified manual fill and retry                                         | Auto sends no code; manual same gates; retry bounded; unsupported manual remains unavailable                              | Unverified                                                          |
| F04 | Type a value or replace/hide/disable fields during retrieval                                        | No overwrite or release into replaced/ineligible group                                                                    | Unverified                                                          |
| F05 | Navigate same tab/document, change origin or foreground during retrieval and just before fill       | Pending request canceled/rechecked; no code at new destination                                                            | Unverified                                                          |
| F06 | Two same-service challenges/tabs, duplicate detection and delayed responses                         | Ambiguous concurrent requests refuse; no cross-tab/account release                                                        | Unverified                                                          |
| F07 | Kill worker before send, after send before ack, after ack; reopen request                           | Conservative uncertain-release/replay refusal; fresh checks and no persistent code                                        | Unverified; durable policy not implemented                          |
| F08 | Decline/revoke optional site permission; set local block mid-request                                | No retrieval/fill; registrations removed; local block wins                                                                | Unverified; production registration absent                          |
| F09 | Disconnect Gmail/logout/change account while list/get/approval pending                              | Abort and invalidate; delayed response never releases                                                                     | Unverified                                                          |
| F10 | Supported page rejects synthetic events or auto-submits on input                                    | Clear unsupported/accurate site-driven behavior; extension no submit/click                                                | Unverified                                                          |
| C01 | Two installations same user change settings; disconnect network                                     | Documented conflict rules and roundtrip; local disable/blocks win; local fill available offline where auth policy permits | Unverified; transport absent                                        |
| C02 | User B queries/writes A installation; anonymous/wrong issuer/audience/expired JWT                   | Server rejects without leaking A data; own-data query works                                                               | Anonymous subject probe passed only; others unverified              |
| C03 | Account switch/reinstall/deregister; revisit devices dashboard                                      | No immutable-owner ID collision/transfer; deleted/stale state accurate                                                    | Unverified                                                          |
| C04 | Trigger deletion/export/settings operation with backend outage                                      | Explicit failure/unknown status, retry safe, no false successful deletion                                                 | Unverified                                                          |
| H01 | History opt-out; perform fills and inspect outbound traffic                                         | Zero cloud event requests; local sanitized events only                                                                    | Gates false; real fill unverified                                   |
| H02 | Opt in, append, withdraw with pending upload, export/delete as A/B                                  | Consent and allowlist; withdrawal prevents new upload; cross-owner refused; deletion/export correct                       | Unverified; policy-disabled                                         |
| H03 | Advance retention in test deployment; stop cleanup then restore; inspect backup policy              | Immediate logical expiry, accepted physical lag/backlog recovery and backup treatment                                     | Unverified                                                          |
| P01 | Run complete connect/fill/retry/logout/sync journey; inspect storage and all destinations privately | No live OTP/body/subject/snippet/Gmail token in app storage/logs/URLs/OTPGuard traffic; allowed auth transport only       | Full live audit unverified                                          |
| U01 | Toolbar/popup keyboard and screen-reader speech through success/refusal/errors                      | Distinct announced status, usable focus/actions; UNKNOWN not accusation                                                   | Unverified                                                          |
| U02 | Web mobile/keyboard/speech; dashboard loading/empty/stale/error/opt-out                             | Honest capability states; no secret/trust override; cloud states reflect real transport                                   | Static browser evidence only                                        |
| O01 | Fresh final configured install/ZIP/update on declared Chrome/OS matrix                              | Correct ID/version/permissions, fixtures excluded, settings migration safe, current audit/CI passes                       | Credential-free packages and baseline Linux CI passed only          |
| O02 | Build reviewed SHA, deploy preview, authorize production alias promotion                            | Exact component source/config/artifact record, correct HTTPS routes/auth/issuer                                           | Existing deployment healthy; full provenance unverified             |
| O03 | Rehearse rollback and auth/backend outage recovery                                                  | Known compatible artifacts/config; no unsafe schema rollback or secret exposure; operator steps work                      | Unverified                                                          |
| O04 | Probe health and inject sanitized test failure                                                      | Correct alert/operator response; no mail/code/raw account history diagnostics                                             | Unverified                                                          |

## Release gates and review procedure

- **Feasibility gate:** R2 accepted before real trusted registry or fill. Failure requires
  owner design decision; UNKNOWN remains safe and Stage A remains available.
- **Pilot gate:** R1/R3 lifecycle and P01; R4/R5 real success plus spoof/origin/ambiguity/
  race/crash refusal on final configured artifact; controlled distribution documented.
- **Public gate:** all applicable R9 matrix rows; two or three claimed flows; final
  artifact and dependencies, approved provider/store status or valid documented exception,
  privacy/operator/support, update/rollback and bounded diagnostics accepted. An approval
  pending is not passed. Inapplicable rows require an explicit stage exclusion.
- **Cloud gate:** R6 acceptance for settings/devices; R10 separate policy/live acceptance
  for history. Profile-local product may ship with cloud gates closed and clear disclosures.

Per PR completion includes exact commands, source/artifact revision, passed/failed/
skipped/unverified checks, live vs synthetic evidence, reproducible owner steps and
residual risks. Existing relevant commands are `bun run check`, `bun run check:convex`,
`bun run test:browser`, fresh isolated builds, `bun audit`, and credential-free
`package:review`/`check:packages`; configured releases need R8's separate reviewed path.
Do not rebuild over preserved owner artifacts or infer live acceptance from CI.

Owner review requested: accept or revise staged scope and R1–R11; select the next single
PR (recommend R2 feasibility first, then R1/R3). Decide later whether to retire draft #3,
include R6 in MVP, pursue cloud history or Google social login. No external action or
implementation starts until selection/authorization. This plan provides no automatic
continuation, chat creation, merge or deployment authorization.
