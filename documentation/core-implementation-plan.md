# Core first: OTPGuard PR plan

Owner direction, October 4, 2026: get the real end-to-end core working, then polish.
This replaces the R1–R11 execution sequence. Historical implementation reports and the
[readiness audit](production-readiness-plan.md) remain evidence and test references,
not a competing work queue. Plan IDs below are not GitHub PR numbers.

## Target journey

Google sign-in on otpguard.net → same account in the extension → explicit Connect
Gmail → enable one supported HTTPS site → request its email code → retrieve and
validate locally → fill the current field once → owner completes the site's login.
Manual fill uses the same checks. Wrong origin, unknown sender, ambiguity, stale mail,
changed account/document or user-entered input must refuse safely. Mail, OTPs and Gmail
tokens stay out of OTPGuard servers, persistent app storage, logs and evidence.

Start with **one real supported flow**. Additional services, cloud history, device
sync and dashboard polish do not block this first controlled demonstration. Public
release remains separate from a working owner-controlled pilot. One flow is pilot
coverage; the design's two or three flows remain a later MVP coverage target.

## What is already ready

- Production website, Clerk and Convex identity infrastructure exist.
- Owner Google login completed; website and exact auth extension recognized the same
  account; fresh Convex probe passed on retry. See [Google acceptance](google-login-acceptance.md).
  Initial refusal/retry and broader auth lifecycle/privacy checks remain acceptance work.
- Parser, detector, insertion mechanism, policy, bounded Gmail transport/retrieval,
  account/mailbox cancellation and local settings/history code exist with synthetic tests.
- Production real-mail release remains disabled, service registry empty, content entry
  absent and cloud transport inactive. Those seams need acceptance/integration, not a
  wholesale rewrite. Google social login does not grant Gmail access.

## Core PRs, in order

### Core 1 — One extension with working login and Gmail connection

Title: `feat(gmail): connect the authenticated extension to a real mailbox`.
Reuse current lifecycle and Chrome identity adapter. Reconcile the stable auth extension
ID `jfncecbkgdnhdppgpblbokkceflpmgif` with the Google Chrome-extension OAuth registration.
Preserve the old Gmail-configured extension and owner files; do not silently replace
its identity or grant. Build the combined artifact in an isolated export. Prefer installed
supported CLIs/APIs for provider operations; browser only for unsupported setup or owner
login/consent. Prepare exact provider changes before any required confirmation.

Acceptance: owner Google login → correct combined extension → explicit readonly Gmail
consent → intended mailbox visible, with Clerk and mailbox identities distinguished.
Denial, missing scope, grant revocation, disconnect failure, account mismatch and worker
restart produce safe clear states. Credentials stay in worker/Chrome-managed cache;
no mail retrieval/fill activation yet. Record actual Google consent/testing status and
minimum scopes; start provider-policy clarification early rather than waiting for launch.

Deliverable: one installed controlled artifact and reproducible connect/disconnect steps,
with live results separate from synthetic tests. Depends on completed basic Google login.

Core 1 local implementation, October 4: one same-ID combined extension connects the
owner-confirmed mailbox after explicit Connect and passes fresh Convex identity. Google
reused project authorization without a new consent screen. Session-bound controller,
regressions and isolated builder are implemented. Project-wide revocation is disclosed
and live revoke/disconnect deferred to preserve the old grant. Fresh consent/denial
and broader live lifecycle/privacy checks remain unverified. See
[Core 1 acceptance](core-1-acceptance.md); owner approved merge and push on October 4
with these live limits. Core 2 feasibility work is recorded below.

### Core 2 — Validate one real service and its mail trust boundary

Title: `feat(security): validate the first real email-code flow`.
Depends on Core 1 for controlled mailbox checks. Select one service whose actual email
challenge and input page can be exercised with an owner-controlled account. Do not assume
candidate brands support the required flow. Reuse MIME/parser/policy code; collect original
evidence locally and commit only sanitized fixtures, explicit template/sender/authenticated
identity mappings, exact destination origins and freshness limits.

Acceptance: direct real mail yields the exact candidate; sender/receipt evidence is justified
against forged Authentication-Results, spoofed From, forwarded/imported mail and replay.
Document provider guarantees, controlled experiments and their limits separately in an ADR.
Header names/position/pass strings or fresh internalDate alone cannot establish provenance.
Sanitizing DKIM bytes invalidates original signatures; fixture provenance must explain this.
Unknown/ambiguous/stale/unsupported messages refuse. Confirm site's supported field/events.

This is the one unavoidable feasibility gate. If no defensible evidence is available,
deliver a concrete finding and owner-selectable product/architecture alternatives in this
PR, keep real fill disabled, and stop dependent activation. Do not invent sender trust
or relax the existing privacy/security contract to make the demo work.

Core 2 local finding, October 4: public Gmail receiver/receipt evidence remains
insufficient under the current contract, including the evaluated ARC alternative.
OpenAI remains a candidate; no real template/input acceptance or service registration.
The permitted feasibility deliverable is proposed for owner review in
[Core 2 acceptance](core-2-acceptance.md) and
[ADR0018](adr/0018-core-2-mail-trust-feasibility.md). Real fill stays disabled;
Core 3 activation requires resolving or explicitly revising this gate. The owner
subsequently selected the local DKIM prototype route; see
[prototype acceptance](core-2-dkim-prototype-acceptance.md) and
[ADR0019](adr/0019-local-dkim-prototype.md). This proposes signer/content authentication
with explicit receipt/replay limits; real service validation and release remain pending.

### Core 3 — Wire and demonstrate the real local OTP pipeline

Title: `feat(extension): complete the real Gmail-to-fill journey`.

Owner-selected scope, October 4: build one reusable retrieval, verification, MIME parsing, challenge detection and fill engine. Canva is the first integration; future services use small exact-origin/sender/template rules. Automatically show an extension-controlled prompt when an eligible code is available, with a **Fill** button. Insert only after the owner clicks Fill; do not submit. This supersedes automatic insertion for this pilot. Complete the remaining resolver, MIME/parser and fresh live-fill acceptance during Core 3. See [Canva evidence](core-2-canva-evidence.md). Historical cryptographic verification is not fresh login acceptance.

Depends on accepted Core 1 and Core 2. Connect existing coordinator/retrieval/policy/
insertion code to the production worker and a minimal content adapter. Add optional
permission only for the validated site; derive tab/document/origin from the browser.
Connect existing auto preference, verified manual fill/retry and sanitized local history
acknowledgments. Only minimal UI needed to perform and understand this journey belongs here.

Acceptance: owner signs in, connects Gmail, enables the site and receives one correct
real fill; leading zeros/events preserved; owner confirms site login directly. Wrong
origin/unknown sender/stale or ambiguous message sends no code. Navigation, foreground
loss, replaced fields, logout/mailbox changes, cancellation and delayed replies refuse.
User-entered values survive, site permission denial/revocation blocks activity, local
blocks win, no extension submit/click. Retrieval/deadline/quota/offline behavior is bounded.
Manual fill cannot bypass policy. Production bundle contains no mock adapters/test origins.

Specify and implement conservative worker crash/replay handling before release: no secret
persistence, minimal bounded local dedup where justified, uncertain prior release refuses
rather than reusing a message. Test before-send/after-send/before-ack/after-ack crash windows.

Deliverable: real success and wrong-origin refusal in the final controlled artifact,
plus an exact recording of remaining unverified cases. No cloud sync/history dependency.

### Core 4 — Accept the complete pilot and repair real failures

Title: `test(core): accept the real end-to-end OTP journey`.
Depends on Core 3. Run the complete journey from fresh setup through owner-confirmed
site completion on the final artifact. Exercise retry/no mail/denied permissions,
account switch/logout/revocation/expiry, concurrency, worker restart/replay and privacy
boundaries under real provider latency. Repair reproducible defects with meaningful
regressions. Do not expand into a dashboard redesign.

Acceptance: checklist below passes, with no unresolved critical/high invariant violation.
Privately inspect actual URLs/headers/cookies/storage/network destinations/logging;
retain only sanitized outcomes. Record exact source/config/artifact/extension identity,
Chrome/OS, date and commands. Confirm a reproducible install/reload and owner test run.
Google login has basic live acceptance; broader lifetime checks and transient refusals
are tested here rather than split into a separate preparatory roadmap.

Deliverable: **working owner-controlled core**, one named supported real flow, known
limits and an acceptance report. Provider/store approval is not inferred from this pilot.

## Core completion checklist

- [ ] Google → website → same combined-extension account → fresh Convex identity.
- [ ] Explicit Gmail consent connects the intended mailbox; denial/revoke/disconnect fail safely.
- [ ] Justified sender/receipt evidence and sanitized real template for one named service.
- [ ] Optional site enablement → actual real-mail retrieval → correct single/split field behavior
      as claimed → owner-confirmed site login; no extension submission.
- [ ] Manual fill/auto-off/retry enforce the same security policy.
- [ ] Wrong origin, unsupported/forged/stale/ambiguous mail and competing challenges never release.
- [ ] Account/mailbox/tab/document/field changes and worker crash/replay never redirect or reuse code.
- [ ] No OTP/mail/Gmail credential in persistent app storage, logs, URLs, telemetry or backend traffic.
- [ ] Final configured artifact excludes mocks; recorded source/ID/permissions and reproducible steps.

Use applicable A/G/S/F/P/O01 cases in the [detailed acceptance matrix](production-readiness-plan.md#exact-end-to-end-acceptance-matrix).
Cloud-history and dashboard cases are deferred while those features remain disabled.
Run relevant unit/backend/browser/artifact checks, pinned builds and current audit in clean
isolated source; do not overwrite preserved owner builds or env files. No full app rebuild
is required for documentation-only work. Owner enters credentials/CAPTCHA directly.

## After the core works

1. **Polish 1 — Connected UX and service coverage:** clarify toolbar/build identity,
   smoother connection/protection/retry states, keyboard/screen-reader testing, measured
   responsiveness and two or three validated real flows for MVP. Security fixes found
   during core work are immediate; cosmetic refinement waits.
2. **Polish 2 — Useful dashboard:** authenticated settings/device transport, real loading/
   empty/stale/error states, two-owner/two-device acceptance and account/device lifecycle.
   Optional and outside the local OTP critical path; no misleading connection claims.
3. **Release — Public distribution and operations:** Google audience/verification and
   applicable assessment, Chrome Web Store review, privacy/support/deletion/operator,
   configured release packaging/version, build provenance, protected promotion/rollback
   and safe monitoring. Existing deployment skips and manual alias behavior require a
   deliberate operational decision. Public release cannot precede required approvals.
4. **Optional later — Cloud history:** separate approved derived-data flow, explicit
   consent, retention/export/delete/backups and ownership acceptance. Keep gates false
   until accepted; cloud history is not required for the local core.

## Execution boundary

One selected PR at a time, report validation and acceptance, then stop for owner review.
This plan authorizes no automatic feature start, new chats, merge, deployment or public
submission. Core 4 is now the owner-selected scope, after owner-approved Core 2/3 merge and push as eb9a503. Its local acceptance and reproducible-failure repairs are authorized; subsequent scopes remain unstarted. Publishing
and provider actions follow explicit session authorization. Preserve failed native draft
PR #3 as separate historical evidence; do not merge it as unfinished core work.

### Core 4 owner-selected connection revision

After successful manual Canva login on the final Core 4 v1 artifact, the owner reported
missing automatic retrieval, slow response and disruptive repeated Gmail Connect.
The owner explicitly authorized remembering prior explicit connection and restoring it
after restart through fresh matching account/mailbox checks, without interactive consent.
[ADR0021](adr/0021-core-4-remembered-mailbox-and-late-challenges.md) supersedes ADR0017's
per-restart explicit Connect rule for this pilot and records the reproduced late-SPA
failure and synthetic account-probe overhead. Full live acceptance remains separate;
see [Core 4 acceptance](core-4-acceptance.md). The owner subsequently reported the v5 attempt worked and authorized commit, merge and push of this Core 4 scope. Broader live acceptance remains partial; deployment and subsequent scopes remain unstarted.

### Core 4 closure

The owner accepted the working Canva pilot after successful full Chrome restart
and fresh login without Connect or Retry. Autonomous browser/artifact/storage checks
passed; remaining owner-assisted failure/privacy cases were explicitly deferred,
not passed. See [Core 4 acceptance](core-4-acceptance.md). The owner authorized
final documentation and proceeding to a separate UI/UX polish pass; this does not
authorize additional service integrations or public deployment.
