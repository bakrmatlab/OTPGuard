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
  See `apps/extension/AGENTS.md`.
- `apps/web`: Next.js 16 site (React 19) on Vercel. See `apps/web/AGENTS.md`.
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
- `bun run build:release <new dir>`: configured extension from `configuration/`.
- The pre-commit hook formats and lints staged files, then typechecks.

## Keep agent usage low

- Never drive a browser yourself (no Playwright MCP, no browser tools, no clicking
  through pages). Use the scripted specs.
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
