# OTPGuard

PR 2 adds a local DOM detector and synthetic fixture harness for visible, enabled
single and split OTP fields. It reports field groups and page-controlled evidence;
email hints are heuristics and grant no trust. Gmail, account authentication,
parsing, authorization, filling, and cloud synchronization remain unavailable.
No real services are currently supported. The packaged extension still has no site
access or content injection; detection is exercised only in the local harness.

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
  It remains empty in PR 2; site injection waits for an explicit supported-site permission design. The manifest test catches
  accidental registration or permission expansion.
- `apps/web`: static landing page, without SDKs, remote fonts, or account features.
- `apps/extension/detection`: in-memory DOM group discovery and finite observation,
  without Chrome APIs, messaging, storage, network requests, or insertion.
- `tests/fixtures` and `scripts/serve-fixtures.ts`: local-only synthetic harness,
  outside both application entry graphs.
- `tests`: production manifest/bundle guards and real Chromium detection/entry tests.
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
exceptions to the production extension or web application. PR 3 insertion remains
separate and has not been started.
