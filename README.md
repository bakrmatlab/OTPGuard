# OTPGuard

PR 8 adds an optional local Chrome OAuth Gmail connection lifecycle. PR 7 provides optional Clerk account sign-in and a worker-owned session boundary. PR 6 provides a secure synthetic pipeline in a separately built development extension.
Its worker derives browser context, parses fabricated mail, enforces authorization and
rechecks the current document before releasing a short-lived code to the bound field group.
The production extension has no content injection or real autofill. Configured account builds
receive only the exact Clerk host access described below; unconfigured builds have none.
Gmail message retrieval, real-service trust and cloud synchronization remain unavailable.

## Requirements and setup

Use Node **22.19.0** (`nvm install && nvm use`) and Bun **1.4.2**.
Install the pinned Bun version using the [Bun installation guide](https://bun.sh/docs/installation).
Confirm `bun --version`. Bun manages dependencies and workspace scripts; Node
runs the framework and verification CLIs through their normal executable entry points.

```sh
bun install --frozen-lockfile
bun run build
bun run build:mock
bun run check
bun x --no-install playwright install chromium
bun run test:browser
```

No Clerk, Gmail, Convex, or other credentials are required. `.env.example` lists optional public/server account configuration; leave it unset for CI. Never add a client secret to an extension.
On Linux, use `bun x --no-install playwright install --with-deps chromium` to install
browser system dependencies too.

`bun run test` inspects the built production manifest; run `bun run build` first.
`bun run check` runs strict type checking, ESLint, Prettier, and Vitest. Browser tests
start the production web server themselves; ports 3100 and 3001 must be free. They use a
temporary isolated Chromium profile, load the unpacked production extension, open
its popup document, and check the web page. They do not use your personal profile
or capture screenshots, video, or traces.

## Development

Run these in separate terminals:

```sh
bun run dev:web
bun run dev:extension
```

Open <http://127.0.0.1:3000>. In Chrome, open `chrome://extensions`, enable
Developer mode, choose **Load unpacked**, and select
`apps/extension/build/chrome-mv3-dev`. Pin OTPGuard and click its toolbar icon.
Reload the extension after manifest changes. Stop both watchers with Ctrl+C.

Account integration uses the production build wrapper below. The Plasmo development watcher
is for credential-free development; do not load account configuration through raw Plasmo.

Use `bun run format` to format implementation files.

## Manual production acceptance

1. Run `bun run build`, then `bun run --filter @otpguard/web start`.
2. Visit <http://127.0.0.1:3000>. Confirm the OTPGuard heading and the notice that
   Gmail connection and autofill are not yet supported. Account authentication is explicitly unconfigured; `/sign-in` shows the same state.
3. In `chrome://extensions`, load `apps/extension/build/chrome-mv3-prod` unpacked.
   Confirm there is no installation error. Pin the extension and click its icon;
   confirm the popup shows unconfigured Gmail and disabled real retrieval/autofill.
4. Inspect the extension's service worker from its Details page. It should load
   without errors; becoming inactive is normal for an idle MV3 worker.
5. Negative/security check: visit an ordinary login page or a local form with an
   OTP input. The extension must not read mail, modify fields, inject UI, or submit.
   Its Details page should show no website access. Unconfigured builds have no Connect control. No production build has a Fill control.
6. Inspect `apps/extension/build/chrome-mv3-prod/manifest.json`: MV3, popup and
   background worker, local settings storage permission, no host access, no content scripts, and
   no externally accessible resources. Remove the extension when finished.

The automated check opens the popup URL; the actual Chrome toolbar click is a
separate manual check. CI runs these checks on GitHub; see the
[Actions results](https://github.com/bakrmatlab/OTPGuard/actions) for each revision.

## Layout and boundaries

- `apps/extension`: popup, account/Gmail-lifecycle production background worker, reusable pipeline modules, icon, and an intentionally
  **zero-byte** `content.ts` entry. Plasmo defaults nonempty content entries to
  all-site injection; its empty-entry handling omits this file from the manifest.
  It remains empty in PR 8; site injection waits for an explicit supported-site permission design. The manifest test catches
  accidental registration or permission expansion.
- `apps/web`: minimal Clerk account host with an explicit unconfigured fallback.
- `apps/extension/detection`: in-memory DOM group discovery and finite observation,
  without Chrome APIs, messaging, storage, network requests, or insertion.
- `apps/extension/insertion`: synchronous native-value setter and input/change events,
  with length, fresh-group and existing-value checks. This mechanism grants no authorization
  and is not connected to production entry points.
- `tests/fixtures` and `scripts/serve-fixtures.ts`: local-only synthetic harness,
  outside both application entry graphs.
- `tests`: production manifest/bundle guards and real Chromium detection/insertion/entry tests.
- `.github/workflows/ci.yml`: credential-free lockfile install, builds, checks, and
  Chromium smoke tests.

React 18 is scoped to Plasmo; React 19 is scoped to Next.js. Workspace scripts
coordinate builds without an orchestrator or unused placeholder packages.
Plasmo currently brings deprecated `source-map`/`stable` dependencies and an
upstream htmlnano/SVGO peer mismatch. Bun's explicit `trustedDependencies` list
allows install scripts for `esbuild`, `sharp`, `lmdb`, and `msgpackr-extract`.
The tested platform binaries work without adding watcher/SWC fallback scripts.

## Manual detection acceptance (synthetic local harness)

Run `bun run fixtures`, then visit <http://127.0.0.1:3001>. This binds only to loopback
and needs no extension or credentials. The status displays group identities, evidence
enums and fixture IDs; it never displays field values or copies page text.

1. Confirm four groups: `single` (one field, email), `split` (six fields, email),
   `authenticator` (uncertain), and `ambiguous` (uncertain).
2. Confirm ordinary quantity, credit-card security code, hidden, disabled and iframe
   fields are absent. No field changes and no form submits occur.
3. Click **Replace single field**. Its group identity changes, while the other groups
   keep theirs. Repeated unrelated attribute mutations do not duplicate results.
4. In DevTools, disable one split input or hide the single form: the affected group
   disappears. Restore it before session expiry to see it return.
5. After 60 seconds the status becomes an empty group list. Reload to start another
   finite session. Stop the fixture server with Ctrl+C when finished.

Observation debounces mutations by 100 ms, stops after 60 seconds or 120 scans,
and clears groups on stop/pagehide. Scans fail closed above 2,000 DOM elements or
200 inputs. Context is bounded to 4,000 characters; truncated context is uncertain.
Field identities last only for a detector instance and must later be bound to a
browser-provided document/request identity. Split groups require 4–8 one-character
inputs in one form/fieldset (or immediate parent), with no hidden/disabled member.
Generic numeric or `code` names alone are insufficient. Payment context is rejected;
authenticator/recovery context remains uncertain. English text heuristics, ordinary
light DOM, and top-level documents are the current coverage boundary. Arbitrary
layouts, shadow roots and iframes are unsupported; stylesheet-only animation changes
without observed DOM mutations may require a rescan. These hints cannot establish
sender identity, destination trust, or an email transaction match.

No permissions were added. Production detection registration is deliberately deferred:
there is no validated real-service registry yet, and Plasmo's default nonempty content
entry would expand to all-site injection. The local harness does not add localhost
exceptions to the production extension or web application. Production insertion orchestration remains deferred.

## Manual insertion acceptance (synthetic local adapter)

Run `bun run fixtures`, then open <http://127.0.0.1:3001/insertion>. The server binds
only to loopback; this page requires no installed extension. It bundles the extension's
React 18 version for controlled fixtures, independently of both production applications.

1. Select `plain`, then click **Fill synthetic fixture**. Expect `filled` and the
   six-digit synthetic value beginning with zero. Submission and submit-click counters
   stay at zero. Reload before each independent scenario.
2. Repeat for `react-single` and `react-split`. The inputs and the output under each
   React form must contain the same complete value, including the leading zero.
3. Type `9` into any target input, then fill that target. Expect `user-value`; all
   existing values stay unchanged. A second fill of an already filled group also rejects.
4. Change the plain field's maxlength to `5` in DevTools, then fill. Expect `length`
   and an empty field. Hide or disable a field: filling rejects the missing group.
5. Do not click the fixture submit buttons during these checks. Counters stay at zero
   throughout filling. Stop the loopback server with Ctrl+C when finished.

The mechanism accepts numeric strings of 4–8 characters and an explicit expected length
from its caller. Split count must match; a single field's declared maxlength, when
present, must match exactly. Number inputs are unsupported to avoid lossy handling.
It rescans the actual element references before writing and after events, refuses
nonempty values (including whitespace), and never focuses, clicks, or submits. Events
are synthetic bubbling `input` then `change`, using the input prototype's native setter.
A page that replaces fields, changes constraints, or changes values during events can
produce `page-interference` after partial insertion; no rollback clears page/user values.
Sites can themselves submit in response to input completion. Frameworks that reject
synthetic events remain unsupported. This is a DOM mechanism, not a security decision;
a future background authorization boundary must approve and bind every production fill.
No code is sent through page globals, attributes, postMessage, storage, or URLs.

## Parser development (synthetic text only)

`packages/otp` exports `parseVerificationCode({ subject, text })`. Supply normalized plain
text, never raw MIME or HTML. Run `bun x --no-install vitest run tests/otp.test.ts`.
Synthetic examples live only in `tests/fixtures/email/normalized.ts`. The applications do
not import the parser or fixtures at this milestone.

Supported English templates are a complete line such as `Your verification code is <digits>`,
`Login code: <digits>`, or a code heading followed by a numeric line. Explicit sign-in/login
or email-verification purpose is required. ASCII numeric lengths 4–8 remain strings.
Inline and next-line templates score 90 and 80 respectively; these are deterministic
heuristics, never probabilities or identity evidence. Multiple occurrences are ambiguous,
including repeated identical codes. Other numbers, quoted/forwarded text, mixed or
unsupported purposes, oversized inputs and unrecognized templates fail conservatively.
Limits are 1,000 subject characters and 32,768 body characters; input is never truncated.

To reproduce success and rejection cases, run the parser test command above: inspect the
leading-zero and ambiguity assertions, then the order/date/phone/price/tracking, quote,
unsupported-purpose and size-limit cases. Run `bun run build && bun run check` and
`bun run test:browser` to check the application boundaries and existing DOM behavior.
No live mailbox or real verification code is needed.

This deliberately narrow grammar may reject legitimate emails containing expiry numbers,
quoted prose, localized text or unfamiliar templates. Real service coverage, bounded MIME
and inert HTML conversion require later validated adapters; extraction never authorizes a
fill or proves sender identity. No storage, network, logs, browser APIs or React dependencies
exist in the pure package. Keep returned candidates ephemeral and outside telemetry.

## Authorization policy development (synthetic evidence only)

`packages/security` exports `authorize(input, registry)` and `normalizeOrigin(url)`.
The default `supportedServices` registry is empty. Run
`bun x --no-install vitest run tests/security.test.ts` for synthetic success and refusal
cases. `VERIFIED` returns a service ID, never a code or fill approval token. All other
states refuse release: `UNKNOWN` for insufficient evidence, `MISMATCH` for an identified
sender/destination mismatch and `BLOCKED` for explicit local policy.

The registry defines exact HTTPS origins, exact sender/authenticated-domain/receiving-
boundary relationships, templates, purposes, code lengths, freshness and provenance.
Canonical default port 443 passes; unexpected ports, credentials and trailing-dot hosts
fail. URL paths and query claims grant no authority. No suffix matching is performed.
Sender evidence must come from a future trusted receiving adapter, never raw headers or
page claims. The contract is not proof of provenance. Complete plausible messages and
competing challenges must be supplied; ambiguity is never resolved by newest selection.
Receipt timestamps must be trusted provider metadata. Parser scores are ignored.

Reproduce acceptance with the test command above: the first test verifies a complete
synthetic request and the empty production registry; destination and sender tests verify
refusal. No mail, credentials or browser changes are needed. The separate development extension now exercises background request binding, runtime
schema validation and release-time rechecks. Gmail provenance remains unresolved.
Production entry points do not import this package or a synthetic registry.

## Secure mock extension demo (PR 6)

Build with `bun run build:mock`, start `bun run fixtures`, then load
`development/mock-extension/build` unpacked in an isolated Chrome profile. This artifact
is named **OTPGuard — SYNTHETIC DEVELOPMENT ONLY**. It is separate from Plasmo output;
`bun run build` never generates it. Never distribute the demo as production.

Keep the fixture tab foreground in the focused browser window. Open each URL in a fresh
navigation; this demo makes one bounded attempt per document and has no retry/override:

- <http://127.0.0.1:3001/pipeline/safe> and `/pipeline/split`: synthetic `042681` fills
  after about 800 ms, preserving the leading zero. Submission counter stays zero.
- `/pipeline/mismatch`: MISMATCH; `/pipeline/unknown` and `/pipeline/ambiguous`: UNKNOWN.
  All fields stay empty. Click the demo extension popup after retrieval to read local status.
- During the delay, replace the field, type a value, navigate, change the URL with history,
  add another OTP form, or switch tabs/windows. No code fills the invalidated request.
- Stop the worker during the delay through Chrome's extension inspector. The field stays
  empty after restart; reload the document to start a fresh request. No request is resumed.

The development manifest adds only `webNavigation` and the exact loopback host permission
`http://127.0.0.1:3001/*`; injection matches `/pipeline*` at top level. The worker independently
checks a closed fixture-path allowlist, runtime sender ID/frame/document/lifecycle, browser
frame URL and focused foreground tab. The fixture-path-derived synthetic HTTPS destination
and fabricated sender authentication exist only in this artifact. The credential-free production build has only local settings storage permission and no host access.
Configured account builds retain zero injection and externally accessible resources.

The fixed development account/mailbox are mock identities, not authentication. One adapter
envelope supplies text, receipt time and sender evidence for the same message. Retrieval
returns the entire synthetic plausible set; it never selects the newest. Simultaneous
same-account/mailbox/service requests latch ambiguity, even if a competitor later cancels.
Before release the worker checks document, URL, focus, deadline and policy again; content
checks the exact live field references, unique group, visibility, empty values and approval
binding/expiry. Codes travel only in an extension message addressed to the browser document.

All requests, approvals, mail and deduplication remain in volatile memory. Local popup
status contains only finite state/reason/service values, never mail, codes or arbitrary
errors. No storage, network retrieval, logging, account SDK or cloud account is used. Worker
termination discards pending work; content never automatically resends and consumes each
approval once. Cleanup drops references best-effort, without claiming secure memory erasure.
The existing DOM insertion mechanism may partially fill if page handlers interfere and may
trigger site-driven submission; OTPGuard itself never submits.

`bun run test:browser` requires both `bun run build` and `bun run build:mock`. Tests use real
Chromium with isolated profiles and no screenshots, video or traces. Unit checks cover
expiry, account/context invalidation, malformed protocols and concurrent requests. Provider
polling/coalescing, MIME, Gmail evidence, persistence/retries and real-service support remain deferred to their assigned later PRs.

## Optional OTPGuard account authentication (PR 7)

Account sign-in identifies the OTPGuard user, **not** the Gmail mailbox and grants no Gmail
consent. The web host and popup display the account ID and primary account email; the popup
separately displays Gmail connection state. Production still has no retrieval or fill adapter.
The separate synthetic demo does not use Clerk and remains credential-free.

Installed SDKs: `@clerk/nextjs` 7.9.10 and `@clerk/chrome-extension` 3.1.90. Follow Clerk's
[extension setup](https://clerk.com/docs/chrome-extension/getting-started/quickstart) and
[Sync Host guide](https://clerk.com/docs/guides/sessions/sync-host). Enable Native API only
in your own authorized Clerk instance, review its bot-protection implications, and register
`chrome-extension://<actual-extension-id>` in the instance's allowed origins without removing
existing entries. A stable extension ID is recommended; verify the loaded ID after each build.
No instance is created or changed by this repository's scripts.

The installed extension SDK uses development browser JWTs in request URLs for `pk_test_`.
That violates OTPGuard's session transport rule: **test keys are unsupported for this PR's
account integration**. Use an existing authorized production instance and HTTPS account host;
if unavailable, leave authentication unconfigured. Do not invent keys or provision a paid
resource just to pass a check. Live recognition remains unverified until configured.
The web host also requires a production publishable key and a server-only production secret.

1. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `apps/web/.env.local`.
   Keep the secret exclusively on the web server. Build/start the web app and serve it on the
   authorized HTTPS origin. This PR does not deploy or provide HTTPS infrastructure.
2. Set the four `PLASMO_PUBLIC_...` values from `.env.example` in
   `apps/extension/.env.account`. The publishable key must belong to the same Clerk instance as
   the web host. `FRONTEND_API` and `SYNC_HOST` must equal the exact production Clerk Frontend
   API HTTPS origin. `ACCOUNT_WEB_ORIGIN` is the web app's exact HTTPS origin. Wildcards, ports,
   credentials, paths, queries, HTTP and loopback are rejected. Never put a secret in this file.
3. From `apps/extension`, run `bun --env-file=.env.account run build`. Use the wrapper rather
   than invoking Plasmo directly: it validates configuration and finalizes the manifest. Do not
   rely on Plasmo-only `.env.production` values; supply the same environment to the wrapper.
4. Load `apps/extension/build/chrome-mv3-prod` in an isolated profile. Sign in through **Open
   account sign-in**, then reopen the popup. Confirm account ID/email match the web page. Signing
   into another Gmail account does not change this identity. No mailbox has been connected.
5. Sign out on the web; reopen/refresh the popup and expect sign-in required. Repeat using the
   popup's **Sign out of OTPGuard** and confirm web sign-out after refresh. A failed remote sign-out
   is reported explicitly; pending work is invalidated before attempting remote sign-out.
6. Switch users or replace the session on the web and verify the new account ID in the popup.
   Revoke/expire a test session using your authorized Clerk controls, then request popup status;
   expect sign-in required. Network failure also pauses connected requests. Do not capture
   tokens or personal account details in screenshots, traces, logs, or review artifacts.

The popup polls status every 15 seconds while open; cookie changes invalidate worker bindings
immediately when observed. Each future connected request must use `createMailboxCoordinator`, which wraps `createConnectedCoordinator`:
its worker refreshes Clerk at request start and before release, binds user/session/generation,
and cancels pending work on account changes, logout, freshness timeout or failed probes.
Switching away and back cannot reuse an approval. Worker restart discards bindings; there is
no offline authorization. No production connected request exists yet; the cancellation checks
exercise the actual coordinator with injected synthetic identities in tests.

Configured manifest: only `cookies`, `storage`, and `<exact Clerk Frontend API origin>/*`.
These SDK-required permissions sync the account cookie; they do not permit content injection.
Chrome host permissions cover all paths (and Chrome's host matching cannot enforce a port);
configuration therefore rejects explicit ports. The web link needs no host permission.
CSP is `script-src 'self'; object-src 'none'; connect-src <exact Clerk API origin>;`.
Clerk's no-remote-hosted-code SDK is bundled; no remote script, eval, broad site permission,
`tabs`, `scripting`, external messaging, or web-accessible resource is enabled.
Unconfigured CSP denies network connections; only local settings storage permission is present, with no host access.

The worker passes a no-cache adapter to Clerk, replacing its default persistent client-JWT
cache, and restricts local storage access to trusted extension contexts. Clerk cookies remain
in the browser's existing cookie store; credentials are not copied to application storage.
Tokens are probed only in the worker, never returned by account UI messages. Only the exact
extension popup sender may request account status/sign-out. Account UI returns ID/email only;
content scripts, pages, URLs, OTP flows and backend services receive no account session token.
Cleanup is best effort, not a secure memory-erasure guarantee. Clerk is an external auth
provider; its own API receives auth traffic. No Gmail, OTP or email processing backend is added.

Reproduce credential-free acceptance with `bun run build`, `bun run build:mock`,
`bun run check`, and `bun run test:browser`. Session tests cover successful authorized synthetic
release plus expiry/logout/user-switch cancellation, switched-away-and-back rejection, stale
async results, failed refreshes, unconfigured refusal and token-free UI responses. Artifact
guards check exact auth permissions/CSP and continued fixture isolation. Browser tests cover
unconfigured web sign-in/popup and the unchanged secure synthetic demo. Live account matching,
Clerk cookie behavior, remote logout/revocation and configured network behavior require the
external configuration above and are separate **unverified** acceptance checks.

## Optional local Gmail connection (PR 8)

No Google client or controlled mailbox is configured in the reviewed default build. Live
Google consent, account selection, denial, reconnect and revocation remain **unverified**.
Clerk setup remains deferred; connecting Gmail does not authorize OTP requests without a
fresh OTPGuard account session. Real retrieval and autofill remain disabled in every build.

Configured Gmail builds require Chrome 116 or newer because worker requests combine cancellation and timeout signals with `AbortSignal.any()`.

Use an isolated Chrome profile and a controlled test mailbox. An owner must first authorize
and perform external setup; this implementation provisions nothing:

1. Obtain a stable extension public manifest key and ID. Chrome's [OAuth tutorial](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
   describes an unpublished Developer Dashboard upload and copying its public key. That upload
   is an external action, not performed here. Keep private signing keys outside this repository.
2. In the authorized Google project, enable Gmail API, configure consent/audience and controlled
   test users, and register a **Chrome Extension** OAuth client with that exact extension ID.
3. Set the three PR 8 public values from `.env.example` in ignored `apps/extension/.env.gmail`.
   Run `bun --env-file=.env.gmail run build` from `apps/extension`. To include Clerk, load its
   existing public configuration into the same build environment. The wrapper validates the
   public key's derived ID against the registered ID; runtime also checks the loaded ID.
   Missing settings produce UNCONFIGURED; partial/invalid build configuration fails explicitly.
4. Load `apps/extension/build/chrome-mv3-prod`, verify the ID in Chrome, open the popup and click
   **Connect Gmail**. Only this action requests interactive consent for `gmail.readonly`.
   Confirm the displayed mailbox from Gmail's [profile API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/getProfile).
   It may differ from the separately displayed OTPGuard account. Broad read-only mailbox access
   is requested; this PR fetches only profile identity, never messages.
5. Deny consent or omit Gmail scope: connection fails safely with a retry explanation. Click
   Connect again to retry. Close/reopen the popup: no unexpected consent prompt should appear.
6. Use **Check Gmail connection** after removing access in your Google account: expect reconnect
   required. An invalid profile token gets one cache eviction/noninteractive retry. No repeated
   polling or interactive retry occurs. Connect explicitly to recover.
7. Change the Chrome Google account and check/reconnect. Sign-in events cancel bindings. If Google
   returns a different mailbox, expect MAILBOX_CHANGED; disconnect before accepting a new mailbox.
   Chrome [identity documentation](https://developer.chrome.com/docs/extensions/reference/api/identity)
   selects the Sync account, otherwise the first Google web account. No arbitrary account picker
   is promised; actual selection must be checked live. Stable-channel account enumeration is
   unavailable. Changing browser profile is the supported setup approach for another mailbox.
8. Click **Disconnect Gmail**: mailbox state disappears immediately, pending profile work aborts,
   and consent already in progress is drained before clearing Chrome's cache. The selected mailbox is rechecked before revocation; a different account cannot be used
   to claim the old mailbox was revoked. Google revocation
   is attempted with a token in a POST body, never a URL. Test with networking offline: expect
   local disconnect plus unconfirmed remote revocation, with instructions to remove access in
   Google account permissions. Cache cleanup failures have a separate explicit warning. Reconnect
   only through Connect. Worker restart drops mailbox/bindings and requires Connect again.

Configured Gmail adds only `identity`, Gmail API host access and the Google revocation endpoint;
CSP connect-src adds those two Google origins. Chrome host permission paths do not constrain
fetch paths, so the adapter itself hardcodes profile/revoke endpoints and rejects redirects.
No identity.email, site access, content injection or external messaging is added. Default
unconfigured builds have only local settings storage permission and no hosts. Generated artifact guards cover both modes.
Only the exact extension popup can invoke lifecycle actions. Tokens stay in worker operation
locals and Chrome's own cache; no refresh tokens or Gmail credentials enter application storage,
content scripts, backend requests, logs or UI. Mailbox identity is local volatile state. Google
receives profile requests in Authorization headers and revocation credentials in POST bodies.
Requests omit cookies, cache and referrers, reject redirects and time out after ten seconds.
Chrome-owned consent dialogs cannot be programmatically aborted by this adapter; disconnect
waits for their completion while authorization stays cancelled. Cleanup is best effort.

`gmail.readonly` is a [restricted scope](https://developers.google.com/workspace/gmail/api/auth/scopes).
Public distribution requires applicable [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
unless an exception applies, plus Chrome Web Store review. Local-only processing does not itself
waive verification. Security-assessment applicability depends on actual storage/transmission;
cloud Gmail-derived activity stays disabled pending its own policy review. Google documents
[revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke) as
project-wide across previously granted scopes/clients, with possible propagation delay.
Use a dedicated authorized project and understand that consequence before testing disconnect.
No verification, registration, upload, publication or paid resource was performed here.

## Gmail normalization and sender evidence (PR 9)

Local helpers now normalize bounded Gmail `format=full` message payloads: canonical
base64url, UTF-8/ASCII/Latin-1 text, a strict inert HTML subset and matching MIME
alternatives. Attachments, unsupported MIME/charsets, hidden/active/quoted markup,
malformed and oversized input fail conservatively. They do not fetch images or links,
execute HTML, or perform Gmail retrieval. Limits include 256 KiB decoded body plus
inspected headers, 64 parts and 32,768 normalized text characters.

**Sender evidence remains UNKNOWN.** Gmail's documented API does not establish the
receiver provenance needed to trust `Authentication-Results` or distinguish normal
SMTP delivery from imported/inserted mail. `internalDate` is retained as unverified
provider metadata, with no fallback to sender `Date`. Header pass strings, From names,
ARC and copied receiver headers cannot authorize a fill. The production service
registry remains empty and real retrieval/autofill remains disabled.

Tests use explicitly fabricated mail, not sanitized real service templates. Real
acceptance still needs authorized controlled Gmail configuration, a justified receiver
boundary and sanitized direct-delivery templates for two or three selected flows.
Sanitization must replace personal identifiers/codes and document that modifying mail
invalidates original DKIM signatures. No live mail or credentials should be placed in
test artifacts. Run `bun x --no-install vitest run tests/gmail-normalization.test.ts
 tests/gmail-sender.test.ts` to reproduce normalization and fail-closed checks; the
full credential-free validation remains `bun run build`, `bun run build:mock`,
`bun run check` and `bun run test:browser`.

## Bounded Gmail retrieval mechanics (PR 10)

Local modules implement fixed-origin contextual list/get, raw JSON response bounds
(16 KiB list, 512 KiB per full message), at most 20 IDs and 10 distinct bodies per
cycle, and immediate/2/6/12/22-second polling with a 60-second deadline. Pagination
or too many plausible bodies refuses the entire set rather than choosing the newest.
Queries use shipped sender addresses and a bounded time window, never DOM text.
HTTP 401 permits one worker-owned noninteractive token retry; quota responses respect
Retry-After and do not read provider error bodies. Network failure never masquerades
as a successful empty result. All envelopes and coalescing state remain volatile.

`createGmailPageCoordinator` composes the existing Clerk/mailbox coordinator with
retrieval. No production listener or site permission invokes it. The empty shipped
registry prevents message requests, and Gmail metadata cannot construct a trusted
sender/receipt envelope. **Real retrieval/autofill remains disabled.** Synthetic
integration success proves mechanics only; sender provenance, real templates and live
Clerk/Google acceptance remain unverified. Restart drops pending requests, approvals,
mail and mailbox bindings; explicit Connect and fresh authorization are required.

Run `bun x --no-install vitest run tests/retrieval.test.ts tests/pipeline.test.ts`
for bounded success, mismatch/stale/ambiguity refusal, quota/network/token failures,
response limits, cancellation, coalescing, restart refusal and mandatory Clerk tests.
The existing mock browser demo remains credential-free. No new permissions, storage,
backend traffic, OAuth registration or external resource changes are introduced.

## Local settings and authenticated metadata backend (PR 11)

The popup now saves the automatic-fill preference (off by default) and explicit local
HTTPS site blocks. Blocks accept exact origins only, excluding paths and query strings;
they never grant site access or trust. These settings persist across worker restarts.
Production real retrieval/autofill remains disabled regardless of the preference.
The default manifest now includes `storage`, with access restricted to trusted extension
contexts; no new host access or network/CSP permission is added.

`convex/schema.ts` and `convex/sync.ts` implement account-scoped preferences and
installation reports. Every endpoint requires Convex-validated identity, derives ownership
from its issuer-qualified token identifier, and refuses foreign installation reads,
updates and takeover registration. Settings contain only `autofillEnabled`. Reports
contain a random installation UUID, a closed provider status and server-recorded last-seen
time. Reports describe what a device observed; they do not prove a currently valid Google
grant. Reports aged five minutes or more are labeled stale; future/invalid timestamps
are unknown. Installation IDs identify extension installations, not hardware attestation.

**Cloud sync is unconfigured.** No Convex deployment or live Clerk JWT integration exists
in this change, and no backend traffic is sent by either app. Backend auth defaults to no
providers. The worker-owned `settings/sync.ts` controller is an inactive, opt-in integration
seam tested with injected transports. Its ten-second deadline, fresh account checks and
account-switch/opt-out cancellation discard stale responses. Pull/push is explicit;
local automatic-fill disablement and site blocks always win. Remote preferences remain
in memory, never overwrite local blocks, and sync is never awaited by the fill coordinator.
A future reviewed worker transport must bind its JWT to the same account/session, use
header authentication at a fixed authorized Convex endpoint, honor cancellation, and keep
Clerk sessions out of persistent storage, URLs, logs and test artifacts. Existing PR7
production-key/no-cache/fresh-session requirements still apply. No external setup is
needed to review the local work, and merely setting an environment variable does not
activate cloud sync.

No OTP, mail, subject, snippet, mailbox ID, Gmail credential, browsing URL, hostname,
security event or trust-policy setting is accepted by the cloud schema/request contract.
Exact blocked origins remain local. Registration is idempotent for its owner and never
transfers ownership; changing accounts cannot take over another account's registered ID.
Device deregistration, ownership migration, cloud history, a dashboard and live transport
acceptance remain deferred. Settings writes are atomic Convex mutations with last-writer
wins semantics; conflicts across offline devices are not automatically reconciled.

Reproduce without credentials:

```sh
bun x --no-install vitest run tests/sync-backend.test.ts tests/settings.test.ts tests/settings-worker.test.ts tests/pipeline.test.ts
```

These tests run the actual Convex functions against `convex-test`'s local runtime/schema,
plus local persistence, strict payload rejection, account isolation/takeover refusal,
report age and actual coordinator block/outage tests. They are not live JWT or deployed
backend acceptance. For a UI check, open the production popup, toggle the preference,
reload and verify it persists. Add `https://example.com` as a local block and reload;
remove it afterward. A URL with `/login?anything=1` cannot be saved as an origin.
Cloud sync must stay visibly unconfigured and real fill disabled throughout.
