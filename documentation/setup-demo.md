# Setup, testing and synthetic demo

Run commands from the repository root unless a different directory is stated.
Install Node 22.19.0 (`nvm install && nvm use` with nvm installed) and
[Bun 1.4.2](https://bun.sh/docs/installation); confirm `node --version` and `bun --version`.
Use the frozen lockfile. No global framework/provider CLI is needed.

## Credential-free setup

Use a fresh clone without provider env files, and a shell without exported Clerk/Google
configuration. Leave `.env.example` values unset; do not copy credentials into the demo.
A developer's existing `.env.local` or app env files may be automatically loaded by the
framework. Preserve them and existing builds before experimenting, or use a separate clone.
Never overwrite a registered extension public key: changing it changes the extension ID.

```sh
bun install --frozen-lockfile
NEXT_TELEMETRY_DISABLED=1 PLASMO_TELEMETRY_DISABLED=1 bun run build
bun run build:mock
bun run check
bun x --no-install playwright install chromium
bun run test:browser
```

On Linux replace the browser-install command with
`bun x --no-install playwright install --with-deps chromium`.
`check` includes types, ESLint, Prettier and Vitest; manifest tests require the matching
production build. Browser tests use ports 3100/3001 and isolated Chromium profiles, with
trace/video/failure screenshots off. One default-suite configured-Gmail case is skipped;
that is not live-provider acceptance. Tests never require your personal Chrome profile.

For another developer's configured Gmail artifact, explicitly load the same ignored public
configuration for both build and checks. From `apps/extension`:
`bun run --env-file=.env.gmail build`; from root:
`bun run --env-file=apps/extension/.env.gmail check`.
A default artifact requires default configuration instead. Do not mix artifacts and envs.

## Five-minute portfolio walkthrough

1. In one terminal run `bun run --filter @otpguard/web start --port 3100` after building.
   Open `http://127.0.0.1:3100`. Visit all six sections and `/sign-in`; account/device/cloud
   data is unavailable, supported services empty, sync/history controls disabled. At 380px
   width there should be no horizontal overflow. Tab to the skip link and press Enter.
2. Create a disposable Chrome profile without Google sign-in, sync or other extensions.
   Load `apps/extension/build/chrome-mv3-prod` via Developer mode in `chrome://extensions`.
   Open the popup: account/Gmail are unconfigured, real retrieval/fill/retry/dashboard
   navigation disabled. Save the autofill preference, reopen and confirm persistence;
   real fill must remain disabled. Block `https://example.com`, reopen and remove it.
   A URL containing a path/query cannot be saved. Export/delete empty local history.
3. In a second terminal run `bun run fixtures`. Load the **separate**
   `development/mock-extension/build` unpacked. Its name is
   **OTPGuard — SYNTHETIC DEVELOPMENT ONLY**. Never use it with real mail or distribute it.
4. Keep the fixture tab foreground in the focused window. Open
   `http://127.0.0.1:3001/pipeline/safe` then `/pipeline/split` in fresh navigations.
   Synthetic `042681` fills after about 800ms, including the leading zero. Submission
   counter stays `0`; do not click Submit. The demo popup reports FILLED after retrieval.
5. Open `/pipeline/mismatch`: field stays empty, demo popup reports MISMATCH.
   `/pipeline/unknown` and `/pipeline/ambiguous` stay empty with UNKNOWN. Reload `/pipeline/safe`
   and immediately type `9` or switch tabs during the delay: it must not overwrite/fill.
   The demo makes one attempt per document; reload for another attempt.
6. Remove both unpacked extensions and delete the disposable profile. Stop only your own
   fixture/web terminals with Ctrl+C. Leave other running development servers untouched.

Optional DOM-only fixtures: `http://127.0.0.1:3001` demonstrates finite detection;
`/insertion` exercises native setter/events and React single/split fields without an extension.
These pages use fabricated codes and confer no real sender/destination trust.

## Focused checks and troubleshooting

```sh
bun run check:convex
bun x --no-install vitest run tests/security.test.ts tests/gmail-sender.test.ts tests/retrieval.test.ts tests/pipeline.test.ts
bun run test:browser tests/browser/pipeline.spec.ts tests/browser/dashboard.spec.ts
bun run cli:check
bun audit --json
```

Convex tests exercise actual functions/schema offline, not deployed JWT verification.
CLI readiness reports versions/config presence, not successful provider integration.
`bun audit --json` is expected to fail while documented advisories remain; do not treat
that failure as a clean audit or use blind incompatible upgrades.

If manifest tests fail, rebuild with the configuration used by the test. If ports 3100/3001
are occupied, stop your own server or choose another time; Playwright refuses reuse.
If the mock stays empty on the safe page, verify the development artifact, loopback URL,
foreground/focused window and fresh navigation; opening its popup during the delay can cancel.
If Chromium is missing, run the browser-install step. If hot reload exits with an advisory,
that is deliberate containment: `dev:extension` and direct `plasmo dev` are not safe demo paths.

## Optional provider work is separate

`.env.example` documents public Google client/key/ID and production-only Clerk configuration.
Google requires a matching registered Chrome Extension OAuth client and controlled test mailbox;
CLI login is not Chrome consent. A configured build adds broad `gmail.readonly` access even
though the current active lifecycle fetches only profile identity. Never embed client secrets.
Chrome chooses the available account; arbitrary mailbox picking is not promised.
Disconnect without a remembered mailbox clears local cache and reports revocation unconfirmed;
it does not revoke an arbitrary selected account. Known-mailbox revocation is checked first
and can affect other grants in the same Google project. Do not test on personal grants.

Clerk development keys are refused because the installed extension SDK transports a browser
credential in query strings. A vercel.app address does not resolve this. Worker-only no-cache
and fresh-session cancellation gates remain mandatory. Convex CLI `dev` configures/pushes
backend code; it is not a readiness command. No empty issuer or provider activation is part
of this walkthrough. See [release gates](release-readiness.md) before any live integration.
