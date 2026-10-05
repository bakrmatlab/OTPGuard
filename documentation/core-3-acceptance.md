# Core 3 — Gmail-to-clicked-fill local review

Proposed title: `feat(extension): complete the real Gmail-to-fill journey`.
Branch: `codex/core-3-gmail-to-fill`, based on Core 1 HEAD
`965bee562240a3178788d9cc1de8ba3bd3dc1bb2`, preserving all inherited uncommitted Core 2 work.
No push, remote PR, merge or deployment.

The shared production pipeline now retrieves bounded Gmail raw bytes, checks the
approved DKIM signer/content, parses a bounded signed plain-text MIME representation,
authorizes exact Canva origin/request binding and waits for a click in the extension
popup. Automatic prompting and manual retry share the same policy. A write-ahead
nonsecret release ledger refuses uncertain replay after worker restart.
[ADR0020](adr/0020-core-3-signed-content-clicked-fill.md) states resolver/receipt/replay limits.

## Validation

Runtime used: `/tmp/otpguard-runtime/bun-darwin-aarch64/bun` (Bun 1.4.2).
Commands below use that executable as `bun`.

- Passed: `bun run typecheck` (all workspace consumers, tools and Convex).
- Passed: `OTPGuard_ARTIFACT=/tmp/otpguard-core-3-review-v4/apps/extension/build/chrome-mv3-prod bun node_modules/vitest/vitest.mjs run` — 357 tests, 25 files on the final export.
- Passed: changed production modules and new tests ESLint.
- Passed: `bun scripts/build-core-3.ts /tmp/otpguard-core-3-review-v4` — isolated configured same-ID artifact; old owner export untouched.
- Passed: `OTPGuard_ARTIFACT=/tmp/otpguard-core-3-review-v4/apps/extension/build/chrome-mv3-prod bun node_modules/@playwright/test/cli.js test -c development/dkim/playwright.config.ts` — two Chromium tests: production content detects the observed nearby email challenge, leaves fields untouched before release and preserves user input; real Web Crypto verifies synthetic DKIM and refuses tampering. Sandbox initially blocked Mach port/browser startup; rerun outside sandbox passed. These tests use only synthetic data and no owner Chrome profile.
- Passed: actual public Canva selector lookup via production resolver — one public key, bounded CNAME chain. AD=false; not DNSSEC attestation.
- Passed: sanitized native read-only Canva field inspection: exact origin `https://www.canva.com`, one text field, one-time-code autocomplete, numeric input mode, maxLength six, nearby email-code instruction outside form.
- Passed: `bun audit --json` — `{}` (zero current advisories); initial sandbox DNS failure was retried outside sandbox.
- Passed: final `git diff --check`.
- Passed: actual same-ID Core 3 update loaded; preserved Clerk session refreshed and Gmail reconnected with the existing grant.
- Unverified: fresh installed-artifact raw Gmail retrieval, automatic popup, user-clicked fill and owner-confirmed Canva login.
- Unverified: live wrong-origin/refusal, permission denial/revocation, quota/offline, lifecycle races and worker crash acceptance in the owner profile. Existing synthetic coverage is separate evidence.

## Acceptance

| Requirement                                                       | Result                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Shared engine, small Canva rules, production wiring               | Implemented; tests passed                                                 |
| Exact signed sender/recipient/content and signed freshness        | Synthetic and historical evidence; fresh live retrieval unverified        |
| Origin/account/mailbox/document/focus/field/local-block gates     | Synthetic coverage; actual Canva field metadata checked                   |
| Automatic extension prompt; clicked fill; no extension submission | Implemented; coordinator/content tests; installed live unverified         |
| Manual retry with automatic prompting off cannot bypass policy    | Passed synthetic test                                                     |
| Leading zeros/framework input events; preserve typed value        | Existing insertion tests and new production-content Chromium refusal test |
| Crash windows before send/after send/before ack/after ack         | Write-ahead refusal tests passed; live crashes unverified                 |
| Mock/test-origin exclusion and tight optional origin              | Configured artifact inspection/tests passed                               |
| No secret persistence/backend flow                                | Source/artifact boundary checks; full live privacy audit unverified       |
| Owner confirms successful Canva login                             | Unverified; owner action required                                         |

## Reproduce the owner-controlled test

1. Load the isolated reviewed artifact at
   `/tmp/otpguard-core-3-review-v4/apps/extension/build/chrome-mv3-prod` using the
   existing extension identity `jfncecbkgdnhdppgpblbokkceflpmgif`; preserve the old build.
2. Open the popup, confirm the intended OTPGuard account, Connect/Check Gmail without
   revoking the preserved project grant, and confirm mailbox privately.
3. Click Enable Canva to grant only its exact optional HTTPS origin. Turn on automatic
   code detection/prompting. Reload the Canva login page.
4. Owner requests a fresh email challenge using their account. Do not copy mail/codes
   into logs, screenshots, this report or developer tools.
5. The extension popup should appear with Fill enabled. Verify the page stays empty
   until the owner clicks Fill. Then the owner completes Canva's Continue action and
   confirms whether login succeeded. A FILLED acknowledgment alone is not login proof.
6. Security case: unrelated origin cannot be registered or retrieve; typing into the
   bound Canva field before clicking Fill preserves the entered value and refuses.
7. With automatic prompting off, Find code / Retry starts the same bounded checks.
   Multiple plausible recent messages refuse; wait for the request lookback to exclude
   prior challenges instead of choosing the newest.

The reviewed update was loaded into the same combined extension ID on October 4.
The old unpacked artifact and legacy extension remain preserved. The existing Clerk
session refreshed, and explicit Connect Gmail reused the preserved read-only grant;
the intended mailbox connected privately. Optional Canva access remains pending owner
approval. No Canva permission was granted or fresh code requested by the agent. The next logical PR is Core 4;
it has not been started.

## First live failure and account-race repair

The owner reported no automatic Fill prompt. Sanitized live inspection showed a
cancelled request, and the later worker required Gmail reconnection. Canva permission
was present, automatic prompting was on, and the visible empty six-character field
with nearby email instruction satisfied the measured detector bounds. Reconnecting
the preserved grant alone did not establish successful retrieval.

`bun node_modules/vitest/vitest.mjs run tests/pipeline.test.ts` reproduced a concrete
same-session overlap defect: a popup refresh superseded a pending authoritative
account check, which returned false and cancelled the coordinator. The regression
failed with CANCELLED instead of FILLED. `AccountGate.current` now retries a superseded
probe once only while the original generation and known identity remain available.
Actual invalidation, sign-out and identity/generation changes still refuse. After the
repair, pipeline/account tests passed (48), full tests passed (358 across 25 files),
extension typecheck and changed-file ESLint passed. No debug logging was added.

A new isolated artifact was built and loaded at
`/tmp/otpguard-core-3-review-v5/apps/extension/build/chrome-mv3-prod`, preserving prior
exports, the same extension ID and grant. This repairs a demonstrated race; it does
not prove that race was the sole cause of the owner's live failure. Fresh pipeline,
automatic prompt and owner-confirmed login acceptance remain pending.

## Live Canva fragmented-text detection repair

The owner reported that v5 still showed no Fill prompt. A bounded live diagnostic
returned only field metadata and booleans: one visible empty numeric input with
`autocomplete=one-time-code` and maxlength six. The real challenge's grandparent
matched email instructions through `textContent`, but failed when traversed with
the production detector's text-node spacing. Normalizing whitespace changed the
same live boolean from false to true. No mailbox, code or page text was retained.

The production browser fixture now splits the mailbox into a separate `strong`
element, matching the relevant Canva DOM structure. Against the v5 bundle the
fixture failed with zero detect messages; against v6 it passed. The fix collapses
whitespace after bounded text traversal, preserving the pre-normalization text
and node limits. It does not relax ambiguity, sender, freshness or fill gates.

Validation: 358 tests across 25 files passed, both isolated Chromium checks passed,
extension type checking and changed-file lint passed. Export v6 is
`/tmp/otpguard-core-3-review-v6/apps/extension/build/chrome-mv3-prod`, loaded under
the existing combined extension ID. Earlier builds and the legacy extension remain.
The existing grant was reconnected without requesting broader access. The repaired
content script was injected into the current Canva challenge through the extension's
worker, and a fresh code requested. Native popup focus changes prevented completing
manual Retry. Fresh live READY/Fill/login acceptance remains **unverified**.

Worker restart deliberately starts disconnected under ADR0017. No automatic grant
restoration, mailbox persistence or change to that contract was introduced. The
separate previously repaired account-current overlap is not claimed as the cause
of this detector failure.

## Startup binding and owned-popup focus repair

After the owner reported another failure, the connected mailbox plus manual Retry
still displayed IDLE. Added closed readiness outcomes for account, mailbox and page
binding refusals, plus no-challenge/content-unavailable retry outcomes. These are
volatile and contain no identity, mail or code. A live v7 retry reported
ACCOUNT_UNAVAILABLE before mail retrieval. A regression through the actual connected
coordinator reproduced a popup account read superseding request admission: UNKNOWN
instead of FILLED. Production account callers now share an authoritative in-flight
probe, discarded on settlement or invalidation. The existing raw latest-read tests
remain; new admission and shared-probe invalidation regressions pass.

The next live v8 retry passed account validation but reported PAGE_UNAVAILABLE.
A temporary worker probe retained only closed browser-binding booleans in session
storage. It showed active tab, allowed origin, active document, matching URL/document,
and matching last browser window, but `focused=false` while the action popup was
open. The probe listener and session entry were removed immediately after inspection.
No mail, code, address or credential was captured.

Foreground checks now recognize an exact live POPUP context only when the trusted
popup replies that `document.hasFocus()` is true. The worker rechecks the popup
document after that reply and the active tab/last window afterward. Opening the
owned popup gets a 500ms mounting grace before focus-event cancellation; retrieval
and release continue to require current foreground authority throughout. Background
popups, missing contexts, changed tabs/windows and failed checks refuse. Chrome's
runtime context reference and Chromium's popup-context tests document the relevant
API; popup contexts cannot be bound through their windowId alone.

v9 validation: 361 tests across 26 files, both isolated Chromium checks, extension
type checking and changed-file lint passed. The isolated v9 export was loaded under
the existing combined ID, the existing grant reconnected, and the content installed
on the owner's existing challenge. Live manual Retry reached SEARCHING. Final
verification, clicked insertion and login acceptance are still pending.

### Live READY reached

The first v9 live retrieval entered SEARCHING then CANCELLED; that attempt's exact
cancellation cause remains unconfirmed. A subsequent fresh manual attempt was timed
without moving browser focus. At roughly 25 seconds after Retry, the actual popup
showed “Canva code verified. Click Fill to insert it.” with an enabled Fill button.
This verifies real-page detection, explicit connected mailbox retrieval, raw signed
content verification, parser/policy acceptance and the owner-click confirmation
boundary on that attempt. The agent did not click Fill or submit the login. Clicked
insertion and successful login await owner confirmation; automatic prompt acceptance
is also not inferred from this manual result.

Reference for the owned-popup context check:
https://developer.chrome.com/docs/extensions/reference/api/runtime#method-getContexts
Chromium's popup-context test notes that popup windowId is -1:
https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/extensions/api/runtime/runtime_interactive_apitest.cc

## Clicked handoff after observer expiry

The owner reported no visible insertion after clicking Fill on the live READY
attempt; popup status subsequently showed CANCELLED. A production-bundle browser
regression reproduced a concrete handoff defect: a manual scan at 59 seconds followed
by observer expiry at 60 seconds set content state to stopped, so an otherwise
current prepare was refused. This is a demonstrated cancellation path, not a claim
that the preceding live click's exact timing was captured.

The finite automatic observer now stops scanning without invalidating an admitted
handoff. Prepare/release independently rescan live field identity, emptiness, page
visibility and worker-issued binding expiry; pagehide/visibility cancellation remains.
The browser regression now exercises both prepare and release after observer expiry
and verifies synthetic insertion. v10 validation: 361 tests, all three Chromium checks,
extension type checking and changed-file lint passed. Live owner-clicked insertion
is still pending and must not be inferred from synthetic insertion or live READY.

v10 was loaded under the existing combined ID, the existing grant reconnected, and
the repaired content installed on the owner's current challenge. A fresh bounded
manual retrieval ended at NO_CODE (no eligible recent envelopes), so this attempt
could not exercise the live click handoff. The owner was asked only whether a new
Canva email arrived in the connected mailbox; no email contents or code were sought.
The synthetic observer-expiry insertion regression is passed; the reported live
clicked-insertion failure is **not yet accepted as resolved**.

The owner confirmed that a new email had arrived. A later bounded worker-only
count diagnostic found zero matching messages in the prior minute and one in the
prior five minutes, with no pagination. Only counts were output; message IDs,
contents, mailbox address and token were not printed or retained. This confirms
a matching recent message but does not establish its age at the earlier failed
Retry. The one-minute request lookback was preserved. Another delayed attempt
reported MAILBOX_UNAVAILABLE; the existing grant was explicitly reconnected and
Chrome returned the connected state. Owner acceptance should request a fresh code,
Retry, and click Fill while staying in Chrome. Switching to Codex before clicking
can legitimately cancel the current foreground-bound request. No live insertion
success or resolution of all cancellation paths is claimed.

## Automatic request after disconnected worker wake-up

On the next owner report, the popup showed IDLE followed by “No mailbox connected.”
This is a fresh-controller state, not evidence of an invalid Gmail grant. Under
ADR0017 worker restart still requires explicit connection. The automatic request
was previously rejected silently, and successful Connect did not rescan the page.

v11 adds a trusted unavailable-prompt callback. Only an automatic request with the
preference enabled, no explicit local block, exact supported origin/permission,
matching active top-frame document/URL and foreground browser binding may open the
owned popup to explain the missing account/mailbox prerequisite. It does not connect
Google or retrieve mail. After a successful exact-popup explicit Connect, automatic
prompting enabled and available triggers the shared scan/retrieval path; prompting
off remains inert. Regression coverage exercises automatic admission failure and
the actual background Connect handler across enabled/disabled/unavailable settings.

Validation: 363 tests in 26 files, all three Chromium checks, extension type checking
and changed-file lint passed. v11 was loaded under the existing combined ID and the
content installed on the existing Canva page. Live inspection then showed the
“Continue with email” form rather than a Code field, so that page could not exercise
automatic code detection. The owner was asked to complete that step themselves and
report the resulting prompt. No email or code was requested in chat. Automatic
connection-prompt and clicked insertion acceptance remain pending; the latest absent
Fill report is not claimed resolved by the synthetic tests.

## Cancellation causes and regained browser focus

The owner reported CANCELLED. A regression through the real production worker's
focus listener showed that it called cancelAll whenever no owned popup was focused,
including when a browser window gained focus. v12 replaces that unconditional
cancellation with per-request current-authority rechecks after the popup mounting
grace. Current foreground requests remain active; stale account/mailbox/page
bindings still cancel. Coordinator regressions prove preservation of the first
cancellation cause and refusal before reservation/release when page prepare fails.

Closed volatile cancellation causes now distinguish deadline, confirmation,
approval expiry, current-check failure, page prepare/release refusal, session or
mailbox invalidation, navigation, tab/focus changes, settings and permissions.
The popup renders those reasons. No context identifiers, identity, mail or code
are included, and the cause is not persisted. The original live CANCELLED attempt
predates those diagnostics, so its exact cause remains unconfirmed.

v12 validation: 366 tests in 27 files, all three Chromium checks, extension type
checking and changed-file lint passed. v12 was loaded under the existing combined
ID and the content installed on the existing Code screen. Without an agent popup
click, the actual extension automatically opened and displayed MAILBOX_UNAVAILABLE,
“No mailbox connected,” and Connect Gmail. This verifies the automatic missing-
connection prompt in Chrome. Live clicked insertion remains pending.

## Owner-confirmed live insertion

After loading v12, the actual popup showed “Canva code verified. Click Fill to
insert it.” and an enabled Fill button. The owner then reported “ok it worked.”
In this context, that confirms the user-clicked Fill action inserted the code on
the real Canva challenge. The agent did not click Fill, read or retain the code,
or submit Canva's Continue action. Successful Canva login is not inferred from
this insertion confirmation. The earlier cancellation's exact cause remains
unconfirmed; the reproduced focus-listener defect and other regressions above
are the evidence for the implemented repairs.

Acceptance now includes actual supported-page detection, connected raw Gmail
retrieval, local signed-content verification, policy acceptance, an owned prompt,
and owner-confirmed clicked insertion on v12. The automatic missing-connection
prompt was separately observed in Chrome. Fully automatic retrieval-to-READY after
a fresh supported challenge, broader lifecycle/provider failure scenarios, and
successful server login remain separate unverified checks. Work stops for owner
review of this Core 3 change; no commit, push, PR publication, merge, deployment,
new feature or new chat is authorized by this acceptance record.

## Publication authorization

After confirming live Fill succeeded, the owner explicitly requested committing,
merging and pushing everything. This authorizes publication of the accumulated
Core 2 evidence and Core 3 implementation together. It does not extend the
verified acceptance scenarios listed above.

## Pre-publication regression checks

The full browser suite exposed legacy disabled-feature assertions and a nearby
context traversal regression: climbing into the document body could mix unrelated
forms into detection evidence. Lookup now stops before body/documentElement;
the existing single/split, authenticator, ambiguous, sensitive, bounded-context
and actual Canva-shaped content checks verify that boundary. Browser assertions
and the credential-free package validator now reflect the optional Canva pilot.
The default content test reads the repository build, so CI needs no owner export.
The default CSP permits only Google DNS and no longer combines its host with the
exclusive `none` source. Package rejection tests still reject configuration,
provider material, unexpected files and escaping dependency links.

Validation: 366 unit tests pass; all 32 applicable browser tests pass across the
full suite and the final two-test popup rerun. One configured OAuth simulation
requires its separate public-config artifact and is skipped in the default build.
Type checking, lint, formatting, production builds and mock build pass.
