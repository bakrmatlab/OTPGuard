# OTPGuard

Chrome MV3 extension that fills email verification codes from Gmail after the user
clicks **Fill**, plus the otpguard.net website (Next.js, Clerk). Read
`documentation/architecture.md` before changing the request flow, and
`documentation/privacy.md` before changing what is stored or sent.

## Rules that protect users

- The popup's Fill click is the only thing that releases a code. Never add automatic
  insertion, form submission, or a path where the website, page or content script
  can release or read a code.
- Sender identity is never verified. Do not claim or imply that a code belongs to
  the current site.
- No new network destinations, permissions or stored fields without updating
  `documentation/privacy.md` in the same change.

## Layout

- `apps/extension`: MV3 extension (React 18), built by `scripts/build-extension.ts`.
- `apps/web`: Next.js 16 site (React 19) on Vercel. Before Next.js work, read
  `apps/web/AGENTS.md` if it exists; Next.js writes version-matched docs pointers there.
- `packages/otp`, `packages/security`, `packages/shared`: TypeScript source packages.
  Import them as `@otpguard/*`, never by relative path.
- `configuration/`: committed public IDs (extension key, OAuth client, Clerk).
- `tests/`: Playwright specs and checks on build output. Unit tests live in each
  workspace's `tests/` folder.

## Commands

- `bun run build`: build the extension and website. Tests read build output, so
  build first after changing build scripts, the manifest or web pages.
- `bun run check`: typecheck, lint, format check and all unit tests.
- `bun run --filter @otpguard/<name> test`: one workspace's unit tests.
- `bun run test:browser`: Playwright suite (about a minute).
- `bun run build:release /absolute/new-dir`: configured extension from `configuration/`.
  The folder must not exist and must be outside the checkout.
- The pre-commit hook formats and lints staged files, then typechecks.

## Extension rules

- The background worker can stop at any moment. Requests and approvals are
  memory-only by design; anything that must survive goes to `chrome.storage.local`
  with `TRUSTED_CONTEXTS` access, and must be listed in `documentation/privacy.md`.
- `apps/extension/background.ts` checks every sender. Page content scripts may only
  send `challenge`, `detect` and `cancel`. The popup is the only sender of
  `pipeline-*` messages (Fill, confirm, retry). Options (`management.html`) may send
  anything except `pipeline-*`. The website goes through
  `apps/extension/website-management*.ts` (exact origin and Clerk session, metadata
  only). Keep each schema closed; never widen one sender's rights to another's.
- After every await, the coordinator rechecks tab, document, origin, focus, account,
  mailbox and settings. Keep that pattern when adding steps.
- The content script registration ID `otpguard-pilot` is stored by Chrome. Do not
  rename it.
- Build output goes to `apps/extension/build/chrome-mv3-prod`; there is no hot
  reload. Rebuild, then reload the unpacked extension in `chrome://extensions`.
- Synthetic mail for unit tests: `apps/extension/tests/fixtures/email.ts`.
- Skills: `chrome-extensions` for MV3 APIs, `clerk-chrome-extension-patterns` for
  Clerk Sync Host and `createClerkClient`.

## Website rules

- The dashboard manages the extension through `apps/web/app/browser-transport.ts`
  and receives metadata only, never codes or tokens. Do not add `fetch`, analytics or
  a backend that sends extension data anywhere.
- Deploys are manual on Vercel; merging does not update otpguard.net.

## Keep agent usage low

- Prefer the scripted Playwright specs to driving a browser yourself (Playwright MCP,
  browser tools, clicking through pages). Driving a browser costs far more usage; do it
  only when the user asks for it or agrees.
- Run `test:browser` only when the content script, popup, Options page, website or
  build changed. Otherwise run the affected workspace's unit tests. CI runs
  everything on each pull request.
- Prefer a unit test over a new browser spec.
- Read failing output, not passing output.

## Conventions

- Conventional Commits (`fix:`, `refactor(extension):`, `test:`, `docs:`, `chore:`).
  One theme per pull request. Keep behaviour changes apart from refactors.
- Docs describe the code as it is now. Update them in the same change; never add
  status, milestone or changelog documents. ADRs (`documentation/adr/`) only for
  decisions that are hard to reverse.
- Extension env variables use the `OTPGUARD_PUBLIC_*` prefix. Vendor skills that
  mention `PLASMO_PUBLIC_*` describe a different toolchain.
- Skills: `.agents/skills/`. Add or update vendor skills with
  `npx skills add <owner/repo> --skill <name> -a codex` and `npx skills update`;
  they are pinned in `skills-lock.json`.
