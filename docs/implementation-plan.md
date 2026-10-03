# OTPGuard — Implementation Plan

Status: PR 1 implemented and locally validated; owner approved publication and merge.
PRs 2–16 have not started.
Updated October 3, 2026.

The [working design](design.md) defines behavior and security policy. This document
defines the delivery sequence. The [original PR proposal](pr-plan.original.md) is
preserved for reference.

## Implementation approach

Keep Plasmo/Chrome MV3, React, strict TypeScript, Next.js, Clerk, and Convex.
Use Bun workspaces with a pinned package-manager version and lockfile (updated at
the owner’s request during PR 1 review). Initially use
workspace scripts rather than adding a build orchestrator. Select compatible maintained
dependency versions and record the Node runtime when bootstrapping; verify compatibility
instead of assuming every latest release works together.

Use Vitest for pure parser/policy logic and DOM-level tests. Use Playwright with Chromium
for real input/event behavior and the loaded extension where supported by the selected
versions. Keep browser fixtures local and synthetic. Validate the browser/tooling choice
in PR 1; document any manual-only platform checks rather than reporting them as automated.
Extension automation uses Playwright's bundled Chromium and a persistent context,
as described in its [extension testing guide](https://playwright.dev/docs/chrome-extensions).
Workspace configuration follows the [Bun workspace documentation](https://bun.sh/docs/pm/workspaces).

Create apps/extension and a minimal apps/web in PR 1. Introduce packages/otp and
packages/security when their implementations arrive; add shared contracts when there
are actual consumers. The foundation does not need empty placeholder packages or a
shared UI framework. Browser adapters remain in the extension, separate from pure logic.

Start a minimal CI workflow in PR 1. Add meaningful tests, threat-model entries, and
privacy notes with the feature they describe. Later security and portfolio PRs consolidate
and audit that work. Runtime diagnostics use structured, sanitized fields throughout.

Implement the full local mock loop before enabling any real Gmail autofill. Investigate
Google OAuth distribution requirements and sender evidence early through documentation
and bounded feasibility work; the numbered connected PRs integrate those findings.
An unresolved sender-evidence gate does not prevent mock work or OAuth connection, but
does prevent release of real email codes to a page.

## PR sequence

Numbers indicate order, not fixed-sized commitments. Split a PR further if it stops
having one understandable responsibility; keep the dependency and review boundaries.

### PR 1 — Runnable workspace foundation

Title: `chore: bootstrap OTPGuard workspace`

Scope: Bun workspace, minimal Plasmo popup/background/content entry points, minimal
Next.js landing page, strict TypeScript, lint/format scripts, test harness, CI,
gitignore, sanitized example configuration, and README setup instructions.
The web app exists as a future sign-in host; dashboard features are deferred.

Acceptance: clean install from lockfile succeeds; both applications build; extension
loads unpacked and popup opens; web page opens; type/lint/format checks pass; a meaningful
smoke test verifies an entry point. CI runs the available checks and builds without
Clerk, Gmail, or Convex credentials. Generated manifest permissions are inspected.

### PR 2 — OTP field detection

Title: `feat(extension): detect supported OTP field groups`

Scope: visible/enabled single and split field detection, email-flow evidence, bounded
DOM observation, and local fixture pages. Return field groups and detection evidence;
detection alone does not authorize or trigger real retrieval.

Acceptance: expected groups are found on supported fixtures; ordinary numeric, payment,
hidden, disabled, and authenticator-only fixtures are rejected or marked uncertain;
dynamic replacement and duplicate detection are tested. Iframes remain unsupported.

### PR 3 — Field insertion mechanism

Title: `feat(extension): fill supported OTP inputs`

Scope: single/split insertion, native setters and appropriate events, leading zeros,
length checks, user-input preservation, and React-controlled fixture coverage.
Exercise synthetic codes only through an explicit local development fixture adapter.

Acceptance: fixture values and framework state update correctly; incompatible lengths
and existing user values fail safely; the extension never clicks submit or submits a
form. Production builds contain no hardcoded demo code or arbitrary-site fill trigger.

### PR 4 — Pure email-code parser

Title: `feat(otp): parse verification-code candidates`

Scope: packages/otp, normalized-text fixtures, contextual candidates, supported numeric
lengths, template/purpose signals, ambiguity output, and deterministic heuristic scores.
Provider MIME decoding belongs to PR 9. Candidate extraction does not prove sender identity.

Acceptance: leading zeros survive; orders/dates/phone numbers/prices/tracking values
are distinguished; quoted codes, multiple plausible codes, and unsupported purposes
fail conservatively. Unit tests assert results and rejection cases, not implementation details.

### PR 5 — Pure authorization policy

Title: `feat(security): authorize service and destination matches`

Scope: packages/security, explicit service/origin registry, sender-evidence contract,
typed VERIFIED/UNKNOWN/MISMATCH/BLOCKED decisions, freshness and ambiguity gates,
URL normalization, and registrable-domain context where necessary.
Use synthetic services in tests; real services stay unsupported until evidence exists.

Acceptance: exact approved origins pass only with sufficient sender/code/request
evidence. Lookalikes, unexpected ports, unapproved subdomains, missing/failed sender
evidence, stale candidates, and ambiguous challenges fail. High parser scores cannot
override policy failures. Page claims cannot authorize a destination.

### PR 6 — Secure mock extension pipeline

Title: `feat(extension): connect the secure mock OTP flow`

Scope: background orchestration, schema-validated messaging, browser-derived context,
account/tab/document/origin/field-group request binding, cancellation, local status,
and explicitly development-only mock sender evidence and email retrieval.

Acceptance: safe fixture fills; mismatch/unknown fixtures receive no code; navigation,
field replacement, background-tab changes, expired approvals, and concurrent ambiguous
requests cannot redirect a code. Worker restart behavior fails safely. The packaged
production build excludes mock trust and origin exceptions. Demo requires no cloud accounts.

Milestone: reviewable secure mock vertical slice.

### PR 7 — OTPGuard account authentication

Title: `feat(auth): connect Clerk web and extension sessions`

Scope: minimal Next.js sign-in host, Clerk extension integration, session coordination,
account identity UI, and session/logout cancellation hooks. This is not Gmail consent.

Acceptance: web and extension recognize the intended account; expiry, logout, and user
switch invalidate pending connected requests. Document SDK-required permissions/CSP.
Local mock demonstration and credential-free CI remain available.

### PR 8 — Local Gmail connection lifecycle

Title: `feat(gmail): add Chrome OAuth connection lifecycle`

Scope: Chrome identity adapter, explicit Connect action, gmail.readonly consent,
granted-scope checks, mailbox profile, token error handling, disconnect/revocation,
and minimal mailbox state UI. Spike stable extension ID/client registration and actual
account-selection behavior before finalizing the UX.

Acceptance: denial/revocation/reconnect/account mismatch cases have tests; credentials
never enter content scripts, app storage, or backend requests. Disconnect cancels work,
clears local state and reports failed remote revocation accurately. Setup and Google
verification findings are documented. No real code is autofilled yet.

### PR 9 — Gmail message normalization and sender evidence

Title: `feat(gmail): normalize messages and validate sender evidence`

Scope: bounded MIME/base64url/charset handling, inert HTML-to-text extraction, receipt
timestamps, sender-authentication evidence adapter, adversarial headers, and sanitized
real templates for the first two or three supported flows. Direct bounded fetching
may support adapter verification; ongoing retrieval orchestration belongs to PR 10.

Acceptance: no remote content loads or HTML execution; oversized/malformed messages
fail safely; forwarded/imported unsupported flows fail conservatively; spoofed From
and forged/duplicate authentication headers cannot become VERIFIED. Record the trusted
receiver boundary and its evidence in an ADR. If provenance cannot be justified, ship
UNKNOWN behavior and report the gate unresolved; do not label verification achieved.

### PR 10 — Bounded real-mail retrieval and fill

Title: `feat(gmail): retrieve codes for authorized page requests`

Scope: contextual list/get retrieval, retry/deadline state machine, rate limits,
deduplication/coalescing, worker recovery, and integration with the existing authorized
fill flow. Depends on PRs 6–9 and a resolved sender-evidence gate for real autofill.

Acceptance: a validated supported real flow fills correctly; mismatch/ambiguity/stale
flows refuse release; retrieval stops on success, navigation, foreground loss, timeout,
or account changes. Tests exercise quota/token/network failures and restart handling.
Inspect data flows to confirm email/code/token stay local. Real Gmail checks use a
controlled test mailbox and are reported separately from synthetic CI tests.

Milestone: connected local prototype; no Convex or cloud activity required.

### PR 11 — Authenticated settings and device sync

Title: `feat(sync): add Convex settings and installation metadata`

Scope: Convex identity/ownership checks, account-scoped settings, installation records,
and device-reported provider status with last-seen time. Local settings remain usable
when sync is unavailable. No trusted-domain editing or cloud security-event history.

Acceptance: cross-user reads/writes and spoofed installation ownership fail; settings
round-trip; explicit local blocks win; stale provider reports are labeled accurately;
sync outages do not interrupt locally authorized fills. Schema and request payloads
contain no OTP, email body, or Gmail credentials.

### PR 12 — Optional activity synchronization

Title: `feat(activity): add opt-in metadata history`

Scope: sanitized event contracts, local history retention, explicit cloud opt-in,
bounded cloud retention, deletion/export, and delivery-failure handling. Assess Google
policy requirements for the actual Gmail-derived metadata flow before enabling it.

Acceptance: disabled cloud history sends no events; exact hostnames/message IDs/raw
URLs/OTP hashes are excluded from cloud events; ownership checks and retention are
tested; deletion works; event upload failure does not block fill. If policy review is
unresolved, keep cloud event upload disabled and present that limitation.

### PR 13 — Extension UX completion

Title: `feat(extension): complete connection and protection UX`

Scope: unify the minimal UI added alongside earlier features into clear account/mailbox,
permission, retrieval, protection, last-action, autofill preference, verified manual-fill,
retry, and dashboard-navigation flows. Security enforcement remains mandatory.

Acceptance: UNKNOWN, mismatch, no mail, reconnect, and explicit block have distinct
explanations; unrelated email does not create a phishing accusation; keyboard and
screen-reader basics work; normal success is unobtrusive. No copy/reveal/override path
can bypass verification. Manual testing covers the whole connected flow.

### PR 14 — Dashboard completion

Title: `feat(web): add account and security dashboard`

Scope: overview, device-reported connected accounts, opt-in activity, devices, settings,
and read-only supported-service/origin information. Use local-history limitations
honestly; the dashboard cannot read unsynchronized browser activity.

Acceptance: authenticated Convex data is scoped correctly; empty/loading/error/opt-out
states work; connection age is visible; no OTP values or trust-policy override controls
exist. Portfolio-quality UI is verified in the browser, including accessibility basics.

### PR 15 — Security audit and targeted repairs

Title: `fix(security): close prototype audit findings`

Scope: review permissions, trust boundaries, sender evidence, origin parsing, code
lifetime, token handling, concurrency, restart behavior, logging, and backend ownership.
Update the existing threat model and implement concrete findings with regression tests.
Split independent substantial fixes into their own reviewable PRs as necessary.

Acceptance: every finding has a severity and disposition; critical/high findings that
violate invariants are fixed or the affected feature is disabled. Document residual
risks precisely. Audit evidence covers actual artifacts and network/storage behavior,
not merely the absence of an otp database column.

### PR 16 — Release and portfolio readiness

Title: `docs: prepare OTPGuard demo and release documentation`

Scope: consolidate README, architecture/privacy/threat docs, sanitized screenshots,
demo/setup/test instructions, packaged build instructions, and distribution readiness.
Existing CI is refined as needed. Keep publication/deployment separate from local readiness.

Acceptance: another developer can follow setup and demo instructions; assets contain
only synthetic data; README accurately describes supported services and limits; OAuth
and store-review status is explicit. A portfolio prototype can be ready while public
distribution remains gated. Split meaningful release automation into a separate PR.

## Workflow for each PR

1. Inspect git state and existing code; read HANDOFF and the applicable design/plan
   sections. Identify the current PR, acceptance cases, and expected changed components.
2. Implement that scope with meaningful feature/security tests. Include minimal UI
   needed to exercise it; reserve broader UI polish for PRs 13–14.
3. Run relevant tests, type checks, lint/format checks, and affected application builds.
   Shared/configuration changes require checking all affected consumers. Include browser
   checks for extension/DOM behavior; credentials-dependent checks are separate.
4. Fix failures and review the diff for secrets, generated artifacts, permission changes,
   unrelated work, and accidental production inclusion of fixtures.
5. Present a reviewable change with the report below. Stop after this PR for user review.

An unavailable prerequisite is recorded as blocked or unverified, with its exact reason.
A skipped check is not a passing check. A scaffolding build does not prove the feature
works. Documentation-only changes use link/content checks rather than application tests.

## Review report

Each completed implementation PR includes:

- Conventional PR title and concise summary of resulting behavior.
- Acceptance criteria with achieved, failed, or unverified status.
- Significant architecture decisions and links to relevant ADRs.
- Major files/components changed and meaningful tests added.
- Exact validation commands, outcomes, and any missing prerequisites.
- Reproducible manual test steps, including a failure/security case.
- Security implications and intentionally deferred limitations.
- The next logical PR, without starting it.

Use a brief report for small changes; expand where evidence or risk merits it. Create a
GitHub PR only when publishing is requested and a remote is configured. Otherwise supply
the local diff and proposed title/description without pretending a remote PR exists.

## What changed from the proposal

- Established HANDOFF as an index rather than duplicating the design.
- Added CI from the foundation and security tests throughout.
- Made demo codes, mock trust, and test origins development-only.
- Separated sender-evidence/MIME verification from retrieval orchestration.
- Separated core Convex settings/device sync from optional cloud activity.
- Replaced editable Trusted Domains with read-only supported origins in MVP.
- Added request binding, safe cancellation, ambiguity rejection, and honest check reporting.
- Distinguished a demonstrable prototype from publicly approved distribution.

Next implementation step: PR 2 only after a separate owner request.
