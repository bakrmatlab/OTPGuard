# OTPGuard

PR 4 adds a pure normalized email-code parser with explicit templates, purpose evidence,
ambiguity and conservative rejection results. Detection and insertion remain exercised
only through synthetic loopback fixtures. Gmail, account authentication, authorization,
production autofill and cloud synchronization remain unavailable. No real services are
currently supported. The packaged extension still has no site access or content injection.

## Requirements and setup

Use Node **22.19.0** (`nvm install && nvm use`) and Bun **1.4.2**.
Install the pinned Bun version using the [Bun installation guide](https://bun.sh/docs/installation).
Confirm `bun --version`. Bun manages dependencies and workspace scripts; Node
runs the framework and verification CLIs through their normal executable entry points.

```sh
bun install --frozen-lockfile
bun run build
bun run check
bun x --no-install playwright install chromium
bun run test:browser
```

No Clerk, Gmail, Convex, or other credentials are required. `.env.example` is
intentionally configuration-free. Never add a client secret to an extension.
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

Use `bun run format` to format implementation files.

## Manual production acceptance

1. Run `bun run build`, then `bun run --filter @otpguard/web start`.
2. Visit <http://127.0.0.1:3000>. Confirm the OTPGuard heading and the notice that
   Gmail connection and autofill are not yet supported. There is no sign-in form.
3. In `chrome://extensions`, load `apps/extension/build/chrome-mv3-prod` unpacked.
   Confirm there is no installation error. Pin the extension and click its icon;
   confirm the popup shows the same unsupported-capabilities notice.
4. Inspect the extension's service worker from its Details page. It should load
   without errors; becoming inactive is normal for an idle MV3 worker.
5. Negative/security check: visit an ordinary login page or a local form with an
   OTP input. The extension must not read mail, modify fields, inject UI, or submit.
   Its Details page should show no website access. There is no Connect/Fill control.
6. Inspect `apps/extension/build/chrome-mv3-prod/manifest.json`: MV3, popup and
   background worker, no API permissions, no host access, no content scripts, and
   no externally accessible resources. Remove the extension when finished.

The automated check opens the popup URL; the actual Chrome toolbar click is a
separate manual check. CI runs these checks on GitHub; see the
[Actions results](https://github.com/bakrmatlab/OTPGuard/actions) for each revision.

## Layout and boundaries

- `apps/extension`: popup, inert background worker, icon, and an intentionally
  **zero-byte** `content.ts` entry. Plasmo defaults nonempty content entries to
  all-site injection; its empty-entry handling omits this file from the manifest.
  It remains empty in PR 4; site injection waits for an explicit supported-site permission design. The manifest test catches
  accidental registration or permission expansion.
- `apps/web`: static landing page, without SDKs, remote fonts, or account features.
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
