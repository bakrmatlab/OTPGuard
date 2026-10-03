# OTPGuard

PR 1 provides a runnable workspace foundation: a Chrome MV3 Plasmo extension and
Next.js landing page for a future sign-in host. Gmail, account authentication,
OTP detection, parsing, authorization, filling, and cloud synchronization are not
implemented. No services are currently supported.

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
start the production web server themselves; port 3000 must be free. They use a
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

Use `bun run format` to format implementation files. Supplied design and workflow
documents are excluded to preserve the original documentation.

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
  Keep it empty until explicit site permissions arrive. The manifest test catches
  accidental registration or permission expansion.
- `apps/web`: static landing page, without SDKs, remote fonts, or account features.
- `tests`: Vitest manifest guard and Playwright production entry-point smoke tests.
- `.github/workflows/ci.yml`: credential-free lockfile install, builds, checks, and
  Chromium smoke tests.

React 18 is scoped to Plasmo; React 19 is scoped to Next.js. Workspace scripts
coordinate builds without an orchestrator or unused placeholder packages.
Plasmo currently brings deprecated `source-map`/`stable` dependencies and an
upstream htmlnano/SVGO peer mismatch. Bun's explicit `trustedDependencies` list
allows install scripts for `esbuild`, `sharp`, `lmdb`, and `msgpackr-extract`.
The tested platform binaries work without adding watcher/SWC fallback scripts.

Read [HANDOFF.md](HANDOFF.md), [design](docs/design.md), and
[implementation plan](docs/implementation-plan.md) before extending the project.
See [foundation decision](docs/adr/0001-workspace-foundation.md) and
[PR 1 review results](docs/pr-1-review.md). PR 2 requires a separate user request.
