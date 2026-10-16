# Development

Run commands from the repository root. Use Node 22.19.0 (`.nvmrc`), Bun 1.4.2 and
the frozen lockfile. Keep ports 3100 and 3001 free for browser tests.

## Credential-free build and checks

Use a clone and shell without provider configuration. Leave `.env.example` values
unset. An existing `apps/web/.env.local` or extension env file can be loaded
automatically, so keep those out of a clean check.

```sh
bun install --frozen-lockfile
NEXT_TELEMETRY_DISABLED=1 bun run build
bun run check
bun x --no-install playwright install chromium
bun run test:browser
```

On Linux, install browser dependencies with
`bun x --no-install playwright install --with-deps chromium`.

- Build first: tests inspect the built manifest and web output.
- `check` runs typecheck, ESLint, Prettier and Vitest.
- `test:browser` starts its own `next start` on 3100 and the fixture server on
  3001, with isolated Chromium profiles. One configured-Gmail case is skipped in a
  credential-free build.
- `bun run fixtures` serves the synthetic detection and insertion pages on its own.

Load the extension from `apps/extension/build/chrome-mv3-prod` with **Load unpacked**
in `chrome://extensions`. There is no hot reload: rebuild, then **Reload**.

## Configured builds

Provider values are public client configuration, never secrets. They live in
ignored files:

- Web: `apps/web/.env.local` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
- Extension account: `apps/extension/.env.account` (`PLASMO_PUBLIC_CLERK_*`,
  `PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN`).
- Extension Gmail: `apps/extension/.env.gmail` (`PLASMO_PUBLIC_GOOGLE_CLIENT_ID`,
  `PLASMO_PUBLIC_EXTENSION_KEY`, `PLASMO_PUBLIC_EXTENSION_ID`).

Load them explicitly. From `apps/extension`: `bun --env-file=.env.account run build`.
Run checks against the same configuration, for example
`bun run --env-file=apps/extension/.env.gmail check` from the root. Do not mix a
configured artifact with default checks.

Only Clerk production keys work: development keys put a browser token in request
URLs. Never change the extension public key; it fixes the extension ID that Google
and Clerk know.

`bun scripts/build-core-3.ts <new absolute directory>` exports the source and builds
the configured extension from the committed public configuration in `configuration/`.
The directory must be new and outside the checkout. To test that artifact, set
`OTPGuard_ARTIFACT` to its build folder.

## Review archives

With `zip` and `unzip` installed and port 3201 free:

```sh
bun run package:review
bun run check:packages
```

These refuse provider configuration, write ignored archives to `dist/review`, and
check the extracted website and extension.

## Production providers

These settings live in provider dashboards, not in this repository.

- **Vercel.** Project root `apps/web`. Git deployments are off
  (`apps/web/vercel.json`), so merging to `main` does not update otpguard.net;
  deploy manually. Clerk keys are set in the Vercel production environment.
- **Cloudflare DNS.** The Clerk and Vercel records for otpguard.net are DNS-only
  (not proxied).
- **Clerk.** Production instance with Frontend API `https://clerk.otpguard.net`
  (`configuration/domain-auth.json`).
- **Google.** The extension uses a Chrome extension OAuth client. Google sign-in on
  the website uses a separate web client with redirect
  `https://clerk.otpguard.net/v1/oauth_callback`. The Google Cloud project is in
  Testing mode, so only listed test users can sign in or connect Gmail.

## Troubleshooting

- Manifest tests fail: rebuild with the same configuration the tests use.
- Ports 3100 or 3001 busy: stop your own server; Playwright does not reuse one.
- Chromium missing: run the browser install step above.
- `bun audit` reports current advisories for the locked tree.
