# Core 4 — Owner-controlled pilot accepted with deferred checks

Proposed title: `test(core): accept the real end-to-end OTP journey`.
Owner-selected scope: Core 4 only. Owner authorized commit, merge and push after the v5 run; deployment remains outside scope.
Date: October 4, 2026, America/Toronto.

## Current conclusion

**Core 4 is closed for the owner-controlled Canva pilot, with deferred live checks.** The fresh Canva journey after a full Chrome restart passed by owner report.
On October 4, the owner confirmed quitting and reopening Chrome, then completing a
fresh Canva login without reconnecting Gmail or clicking Retry, using the installed
v5 artifact. This establishes full-browser restart restoration and successful fresh
site completion for that attempt. Broad live failure/cancellation/privacy acceptance
remains partial. The browser suite subsequently passed with production-content checks pointed at v5; the configured Gmail UI simulation also passed separately.

The owner confirmed insertion on Core 3 v12. The owner subsequently confirmed in this Core 4 chat that Canva login did succeed after that Fill. This adds owner-confirmed server completion to the v12 evidence; it is not a fresh Core 4 artifact run.
The automatic missing-mailbox prompt was observed separately. See
[Core 3 acceptance](core-3-acceptance.md) and
[ADR0020](adr/0020-core-3-signed-content-clicked-fill.md).

## Source and artifact

The checkout was clean on `main`. `git fetch origin` succeeded; HEAD and refreshed
origin/main both resolved to `eb9a503cba874ed83f18c6dd55938dc53818c250`.
Created `codex/core-4-pilot-acceptance` from that commit. No owner configuration,
installed extension, permission or provider grant was changed during baseline checks.

Configured artifact:
`/tmp/otpguard-core-4-review-v1/apps/extension/build/chrome-mv3-prod`.
The existing builder refused overwrite and excluded owner environment files/builds.
Same reviewed ID: `jfncecbkgdnhdppgpblbokkceflpmgif`; version `0.0.0`.
Source, public-config/build-script hashes and every artifact file hash are recorded in
[artifact provenance](core-4-artifact.json). Chrome UI confirmed this exact artifact loaded under the same combined ID, replacing the v12 source path while preserving its permission state and both installed extension identities. The previous named v12 owner export was preserved.

Host: macOS 27.0.1, build 26A434; installed Google Chrome 154.0.8037.93.
Runtime: `/tmp/otpguard-runtime/bun-darwin-aarch64/bun`, Bun 1.4.2.
Synthetic browser tests use Playwright's isolated Chromium, not the owner's profile.

Manifest permissions: storage, cookies, identity, scripting, webNavigation.
Required hosts: exact Clerk frontend, Gmail API, Google revocation endpoint,
configured Convex endpoint and Google DNS. Optional host: `https://www.canva.com/*`.
No broader site coverage, cloud-history activation or provider scope was added.

## Executed validation

For commands below, `bun` means the pinned executable above with its directory on PATH.

| Command                                                                                                                                                                        | Location / outcome                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `bun run check`                                                                                                                                                                | Owner source checkout; type/lint/format passed; 366 tests in 27 files passed   |
| `bun scripts/build-core-3.ts /tmp/otpguard-core-4-review-v1`                                                                                                                   | Source checkout; fresh configured artifact passed                              |
| `OTPGuard_ARTIFACT=/tmp/otpguard-core-4-review-v1/apps/extension/build/chrome-mv3-prod bun node_modules/@playwright/test/cli.js test -c development/dkim/playwright.config.ts` | 3 final-artifact synthetic Chromium tests passed                               |
| `bun install --frozen-lockfile`                                                                                                                                                | Clean HEAD export `/tmp/otpguard-core-4-validation-v1`; 294 packages installed |
| `bun run build`                                                                                                                                                                | Clean export; production extension and web builds passed                       |
| `bun run build:mock`                                                                                                                                                           | Clean export; passed                                                           |
| `bun run check:convex`                                                                                                                                                         | Clean export; backend typecheck and 16 tests passed                            |
| `OTPGuard_ARTIFACT=/tmp/otpguard-core-4-review-v1/apps/extension/build/chrome-mv3-prod bun run test:browser`                                                                   | Clean export; 32 passed, 1 skipped                                             |
| `bun audit --json`                                                                                                                                                             | Clean export; `{}` (zero advisories at execution time)                         |
| `bun run package:review`                                                                                                                                                       | Clean export; credential-free ZIPs/provenance passed                           |
| `bun run check:packages`                                                                                                                                                       | Clean export; extracted standalone web and MV3 worker/popup smoke tests passed |

Skipped browser case: configured Gmail UI-only denial/reconnect/mailbox-change/
revocation simulation requires a separate public-config fixture artifact. The default
suite is unconfigured. This skip is not live OAuth acceptance.

The first Chromium attempt failed before running test logic because the sandbox
blocked its Mach-port startup. Rerunning outside the sandbox passed. An initial clean
export using dependency symlinks failed Turbopack's filesystem-root check; installing
from the pinned lockfile inside the export resolved that harness limitation.
Before the clean export was prepared, a default build also ran successfully in the
owner checkout; this regenerated default ignored outputs. Named owner exports were
not overwritten. Subsequent build and packaging checks used the clean export.

## Acceptance ledger

| Cases                                                          | Core 4 result / remaining evidence                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A01: Google website/shared combined account/fresh Convex       | Basic prior live evidence; fresh final-artifact run pending                                                                                   |
| A02–A06: logout/switch/revoke/expiry/offline/delayed authority | Synthetic regressions passed; broader live run pending                                                                                        |
| G01: denial or missing scope                                   | Synthetic denial/scope regressions passed; live denial pending                                                                                |
| G02: explicit connection and worker restart                    | Explicit connection and worker reload observed; full Chrome restart with no reconnect passed by owner report                                  |
| G03–G04: disconnect/revoke/expiry/mailbox change               | Synthetic regressions passed; live provider cases pending                                                                                     |
| G05: no mail/retry/quota/network/provider latency              | Synthetic bounded polling/quota/cancellation passed; live cases pending                                                                       |
| G06: malformed/oversized/inert MIME                            | Synthetic coverage passed; no live adversarial delivery claimed                                                                               |
| S01: real signed Canva template                                | Signed-template evidence inherited; fresh v5 Canva journey after Chrome restart passed by owner report                                        |
| S02–S05: forged/stale/ambiguous/unsupported/wrong origin       | Synthetic verifier/parser/policy and DOM cases passed; actual live refusal matrix pending                                                     |
| F01: automatic prompt, clicked insertion, owner login          | Owner confirmed fresh Canva login after full Chrome restart without Connect or Retry on v5                                                    |
| F02: real split flow                                           | Not claimed for Canva; split/leading-zero mechanism passed synthetic tests only                                                               |
| F03: manual/auto-off/retry                                     | Synthetic same-policy regression passed; final live retry pending                                                                             |
| F04–F06: field/tab/document/focus/concurrency                  | Synthetic races and isolated DOM/browser refusals passed; owner-profile latency checks pending                                                |
| F07: worker crash/replay                                       | Synthetic write-ahead uncertain-release refusal and browser restart passed; live windows pending                                              |
| F08–F10: permission/block/invalidation/site events             | Synthetic coverage passed; idle Canva permission removal/unregistration and restoration verified in Chrome; pending-request cases remain open |
| P01/H01: privacy and disabled cloud upload                     | Source/artifact/test boundaries and installed metadata schemas checked; complete live network/logging audit remains pending                   |
| O01: reproducible configured install/reload                    | Build/provenance and installed v5 path verified; owner-reported full Chrome restart journey passed                                            |

Cloud settings/device/history, dashboard polish, additional services and public release
are outside Core 4. Provider/store approval is not inferred from local acceptance.

## Owner-controlled acceptance procedure

1. With any filled code out of view, open `chrome://extensions`. Verify the combined
   ID and current loaded path, preserving the legacy extension and named exports.
   Update only the combined installation to the exact Core 4 artifact above.
2. Confirm website Google sign-in and the same extension account privately; run the
   fresh Convex identity check. Owner enters credentials/CAPTCHA themselves.
3. Confirm remembered Gmail restoration after restart under
   [ADR0021](adr/0021-core-4-remembered-mailbox-and-late-challenges.md). This happy-path
   case passed by owner report; changed or unavailable authority must still require
   reconnection. Preserve the legacy grant when testing provider failures.
4. Confirm optional Canva enablement and automatic prompting. Owner starts one fresh
   challenge; keep Chrome foreground. Record only whether the owned prompt reaches
   READY, whether the field remains empty, and any closed refusal/cancellation reason.
5. Owner clicks Fill, then Canva Continue. Owner reports insertion and login success
   separately. No agent Fill/Continue, code reading, email request or screenshot.
6. Exercise manual retry/no mail, user-entered value, changed field/document/focus,
   concurrency, local block/permission removal and worker restart without recording mail.
   Perform private inspection only with sanitized booleans/counts/destinations retained.

Fresh denial/revocation must use an owner-approved controlled grant. Google's project-
wide revocation can affect the preserved legacy grant (ADR0017); baseline acceptance
has not revoked it to manufacture evidence. Session revocation/account changes likewise
need a deliberate owner-controlled run. Missing live prerequisites remain unverified.

## Retained pilot limitations

DKIM proves approved signer/covered-content integrity, not authenticated direct SMTP
receipt or server transaction binding. Intact unseen copies with a different Gmail ID,
other installations and pre-reservation replay remain unresolved. Google's HTTPS DNS
resolver and unsigned upstream DNS are pilot dependencies; AD=false is not DNSSEC
attestation. The supported representation is one signed plain-text MIME part, numeric
six-digit Canva login code on the exact approved origin. A filled field is not server
login proof. No full live privacy or critical/high-invariant clearance is claimed yet.

## Live continuation

The owner confirmed successful Canva login after Core 3 v12 clicked insertion.
Chrome subsequently showed the combined ID loaded from the exact Core 4 v1 path.
The legacy extension remained enabled, Canva access and automatic prompting remained
enabled, and the reopened popup reported no mailbox connected after worker update,
as required by ADR0017. Shared account controls became available after startup.
The fresh Convex probe returned “Cloud identity verified for this check.” Explicit Connect Gmail returned a connected mailbox using the preserved grant; no fresh consent/denial or project revocation is claimed. A new Canva login tab was opened for the owner-controlled fresh challenge.

## Owner feedback and repaired v3 artifact

The owner reported that the fresh Core 4 v1 run worked through Find code / Retry,
including Canva login, but automatic retrieval did not occur and response was slow.
The owner explicitly authorized safe remembered connection restoration after restart,
without an automatic consent prompt. [ADR0021](adr/0021-core-4-remembered-mailbox-and-late-challenges.md)
supersedes ADR0017's per-restart Connect requirement for this pilot.

A new production-content Chromium regression failed against v1 with zero automatic
detect messages after a fresh SPA code field appeared at 90 seconds. The repaired
content adapter continues throttled mutation-triggered scans after its one-minute
polling window, retaining traversal bounds, field deduplication and request deadlines.
The same regression passed against v3. This identifies a concrete cause, without
claiming to know the exact timing of the preceding live attempt.

A connected-coordinator latency harness measured 11 sequential account probes versus
7 after eliminating the duplicate remote read within each current check. Under its
250 ms-per-probe model this reduces account-check overhead from 2.75 s to 1.75 s.
The final account probe still runs authoritatively after browser checks; settled
responses are not cached. This is modeled overhead, not measured live speed. Mail
arrival/Gmail/DNS latency and the bounded retry schedule remain separate contributors.

Remembered connection persists only version plus two digests in trusted local storage.
Fresh same-session Clerk authority, noninteractive existing Chrome grant, readonly
scope and matching Gmail profile are required before CONNECTED becomes visible.
The regression suite covers concurrent restore, wrong account/session/mailbox,
signed-out/revoked authority, late logout, corrupt/unreadable data, automatic page
admission, pending Connect versus Disconnect and removal failure. No token, plaintext
mailbox, OTP or approval is saved. Consent remains explicit.

Historical v3 configured artifact:
`/tmp/otpguard-core-4-review-v3/apps/extension/build/chrome-mv3-prod`.
The provenance record contains v1 and v3 hashes plus the exact changed source hashes.
Chrome UI confirmed v3 loaded under the existing combined ID, preserving prior exports
and site access. One explicit Connect saved the connection intent. After clicking the
extension's Reload control, reopening the popup restored a connected mailbox without
clicking Connect or showing consent. This is actual extension-worker restart evidence;
a full Chrome/browser restart remains unverified. The owner account label/mailbox were
not retained. Fresh automatic retrieval-to-READY and speed acceptance remain pending.

Validation after repairs: `bun run check` passed type/lint/format and 379 unit tests
in 28 files. All four targeted configured-artifact Chromium checks passed. Revised
source was exported without owner env/builds to `/tmp/otpguard-core-4-validation-v2`,
installed with `bun install --frozen-lockfile`, and production/mock builds passed.
The full browser suite in that export passed 33 tests with one configured OAuth
simulation skipped. Credential-free packaging and extracted-package smoke tests passed.
The current audit again returned `{}`. `git diff --check` passed. No publication,
merge, deployment or provider revocation occurred.

## v3 feedback and v4 delayed-mail repair

The owner again reported needing manual Retry and suggested that automatic lookup
occurred before mail arrived. An actual early-empty retrieval already retries, but the
old schedule stopped after 22 seconds. `bun node_modules/vitest/vitest.mjs run
tests/retrieval.test.ts -t 'after thirty seconds'` failed with an empty result when
synthetic mail first arrived at 30 seconds. Adding checks at 32 and 42 seconds made
the same regression pass. All 19 retrieval tests passed, including bounded no-mail,
quota, cancellation and stalled-provider deadline cases. The initial read remains
immediate; no delay is added for mail already available. Total cycles increase from
five to seven within the same 60-second deadline and per-cycle caps.

Configured artifact v4 was built in a new isolated export at
`/tmp/otpguard-core-4-review-v4/apps/extension/build/chrome-mv3-prod`.
This repairs a reproduced late-mail scenario. The actual pre-Retry live status and v4
owner acceptance remain pending; missing automatic admission or cancellation must not
be inferred to be fixed by a polling change.

Final v4 checks: type/lint/format and 380 unit tests passed; all four configured-artifact
Chromium regressions passed. Chrome confirmed v4 loaded under the same combined ID
and exact v4 path. Owner-profile automatic delayed-mail acceptance remains pending.

## v5 automatic prompt repair

The owner reported confirmation cancellation and confirmed no popup appeared.
The failure is therefore not evidence of a declined Fill. Three red/green worker
regressions reproduce popup rejection, a stale rejection affecting a newer request,
and omission of the request window from Chrome's popup call.

The worker now validates the request document and foreground tab and passes its
browser-derived window ID to openPopup. A rejected opening preserves verified READY
for the existing approval lifetime; the popup shows an unavailable-prompt explanation.
Expiry has a specific confirmation-expired reason. No automatic Fill, expiry extension,
or authority relaxation was added. A stale async opener cannot open after cancellation.

Type, lint, format and 383 unit tests passed. The fresh configured v5 artifact was
loaded in Chrome under the same ID and its exact isolated path verified. Owner-profile
automatic prompt appearance and end-to-end acceptance remain pending.

The v5 Chromium rerun could not start the configured web server (exit 1), both
in the checkout and prior validation export. It did not execute tests; prior v4
Chromium results are retained separately and are not claimed for v5.

## Owner review and publishing authorization

After v5 was loaded and Canva refreshed, the owner replied “worked” to the request
for a fresh code and automatic-popup check. This records a successful owner-reported
attempt, without inferring all lifecycle/privacy cases or separate server completion.
The owner then explicitly authorized committing, merging and pushing all changes in
this Core 4 scope. Broader acceptance limitations above remain open; no deployment
or next scope is authorized.

## Full Chrome restart acceptance — October 4, 2026

The owner explicitly confirmed this exact procedure worked: quit and reopen Chrome,
then complete one fresh Canva login without reconnecting Gmail or clicking Retry.
The last UI-verified installed artifact was v5, now represented by merged source
commit 759b642. Evidence is owner-reported; no code, mail, credentials or screenshot
was collected. This updates G02 and the fresh Canva journey/server-completion result.
It does not close revocation, account switching, interrupted pending-request replay,
permission cancellation or live privacy-audit cases.

## Autonomous acceptance continuation — October 4, 2026

The owner requested the remaining checks that do not require owner participation.
No production source changed. These checks used merged Core 4 source 759b642 and
the previously installed v5 artifact; browser test sources in the validation export
were byte-for-byte identical to the current checkout.

### Automated checks

- `bun run check`: type/lint/format passed; 383 tests in 29 files passed. This
  includes synthetic no-mail/late-mail, quota/offline/deadline, authority changes,
  confirmation expiry, local blocking, user-input protection and crash/replay cases.
- Initial `DEBUG=pw:webserver OTPGuard_ARTIFACT=/tmp/otpguard-core-4-review-v5/apps/extension/build/chrome-mv3-prod bun run test:browser`
  in `/tmp/otpguard-core-4-validation-v2` reproduced `listen EPERM` at
  127.0.0.1:3100. This was sandbox local-server denial, not an application defect.
- The same suite with local-server/Chromium execution permission passed 33 cases,
  with one configured Gmail UI simulation skipped. The production-content tests
  use v5; other cases use the suite's unconfigured, mock or local DOM fixtures.
  This is not a complete production-provider end-to-end simulation.
- The skipped Gmail UI simulation was separately run using a newly isolated
  Gmail-only public-config artifact in `/tmp/otpguard-core-4-gmail-ui-fixture`.
  `bun /tmp/otpguard-core-4-gmail-ui.ts` built the fixture and ran
  `tests/browser/gmail.spec.ts`: all three cases passed. The configured case
  simulated denial, mailbox change and unconfirmed revocation and asserted zero
  external requests. No live OAuth or owner-profile grant changes occurred.
- `bun /tmp/otpguard-core-4-artifact-check.ts` supplied the reviewed public
  configuration to `tests/manifest.test.ts` against v5: all five checks passed,
  including manifest, production permission/CSP and bundle boundaries.

The temporary scripts are verification helpers outside the repository, not shipped
application code. No server or production-code fix was necessary.

### Installed Chrome checks

Chrome was on the logged-in Canva home page with no active challenge. The extension
reported IDLE and restored a connected mailbox; only sanitized state was retained.

- Automatic prompting changed from on to off and back to on through the popup.
- Canva's exact local block was saved and removed; no blocks remained afterward.
- Removing only `https://www.canva.com/*` permission returned success and a
  subsequent permission check returned false. The production permission listener
  unregistered the Canva content script. Enable Canva restored the original
  permission; both permission and content-script registration were then true.
- Read-only DevTools queries inspected local data privately and returned only
  schema booleans/counts. Remembered connection was version plus two SHA-256
  digests; settings, local activity and replay entries had documented metadata
  shapes; no unknown `otpguard.*` storage keys existed. The first activity check
  omitted the documented `action` field from its expected shape; correcting the
  audit predicate produced a passing result. This was a verification-script
  error, not malformed stored history. No stored values or identities were logged.

Temporary audit console output was cleared, DevTools and the added management tab
were closed, Canva was reloaded, automatic prompting stayed enabled, no local block
remained, and original Canva permission/registration were restored. The legacy
installation and Google project grant were preserved.

These installed checks establish idle settings/permission behavior and a current
application-storage schema snapshot. They do not prove pending-request cancellation,
absence of historical leaks, Chrome-managed credential internals or complete live
network/logging privacy. Those checks, fresh logout/account switch/revocation, and
owner-generated interrupted/concurrent login requests remain owner-assisted work.

## Owner closure and deferrals

The owner chose to skip the remaining owner-assisted checks and then authorized
finalizing Core 4 and proceeding to UI/UX polish. Active-request interruption/
concurrency, logout/account switch/provider revocation, and full live network/logging
privacy checks are deferred and remain unverified. This is acceptance of the working
one-service owner-controlled pilot, not full security/privacy clearance or public
release readiness. Existing DKIM receipt/replay limitations remain unchanged.

Core 4 implementation was committed, merged and pushed as 759b642. This report
adds the subsequent browser-restart result and autonomous checks. No production
code changed in this closeout. UI/UX polish is a separate owner-requested scope.
