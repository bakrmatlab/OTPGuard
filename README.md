# OTPGuard

OTPGuard fills email verification codes from Gmail in Chrome, the way Safari fills
codes from Mail. On a page that asks for an email code, it reads your recent Gmail,
finds the code and offers **Fill**. Nothing is filled until you click.

It has two parts:

- The **extension** finds and fills codes. Gmail tokens and mail never leave it, and a
  code leaves it only for the page where you click Fill.
- The **website**, [otpguard.net](https://otpguard.net), handles sign-up, guided setup
  and a dashboard that manages the extension in your Chrome profile.

OTPGuard does **not** check that a code belongs to the site you are on. A page can make
a service send you a real code and receive it if you click Fill. Click Fill only on a
page you meant to use. OTPGuard never submits a form, but a site can submit on its own
after its fields are filled.

## Stack

| Layer     | Built with                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension | [![Chrome MV3][chrome-badge]][chrome] [![React][react18-badge]][react] [![Clerk][clerk-ext-badge]][clerk-ext]                                             |
| Website   | [![Next.js][next-badge]][next] [![React][react19-badge]][react] [![Clerk][clerk-next-badge]][clerk-next] [![Vercel][vercel-badge]][vercel]                |
| Toolchain | [![TypeScript][ts-badge]][ts] [![Bun][bun-badge]][bun]                                                                                                    |
| Quality   | [![ESLint][eslint-badge]][eslint] [![Prettier][prettier-badge]][prettier] [![Vitest][vitest-badge]][vitest] [![Playwright][playwright-badge]][playwright] |

[chrome-badge]: https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white
[react18-badge]: https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black
[react19-badge]: https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black
[clerk-ext-badge]: https://img.shields.io/badge/Clerk_Chrome_SDK-3.1-6C47FF?logo=clerk&logoColor=white
[clerk-next-badge]: https://img.shields.io/badge/Clerk_Next.js-7.9-6C47FF?logo=clerk&logoColor=white
[next-badge]: https://img.shields.io/badge/Next.js-16.3-000000?logo=nextdotjs&logoColor=white
[vercel-badge]: https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white
[ts-badge]: https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white
[bun-badge]: https://img.shields.io/badge/Bun-1.4-000000?logo=bun&logoColor=white
[eslint-badge]: https://img.shields.io/badge/ESLint-10.12-4B32C3?logo=eslint&logoColor=white
[prettier-badge]: https://img.shields.io/badge/Prettier-3.8-F7B93E?logo=prettier&logoColor=black
[vitest-badge]: https://img.shields.io/badge/Vitest-5.0-6E9F18?logo=vitest&logoColor=white
[playwright-badge]: https://img.shields.io/badge/Playwright-1.63-2EAD33
[chrome]: https://developer.chrome.com/docs/extensions
[react]: https://react.dev
[clerk-ext]: https://clerk.com/docs/references/chrome-extension/overview
[clerk-next]: https://clerk.com/docs/references/nextjs/overview
[next]: https://nextjs.org
[vercel]: https://vercel.com
[ts]: https://www.typescriptlang.org
[bun]: https://bun.com
[eslint]: https://eslint.org
[prettier]: https://prettier.io
[vitest]: https://vitest.dev
[playwright]: https://playwright.dev

## Documentation

- [AGENTS.md](./AGENTS.md): rules and conventions for contributors and coding agents.
- [Architecture](./documentation/architecture.md): how a code goes from Gmail to the page,
  trust boundaries and email coverage.
- [Privacy and security](./documentation/privacy.md): what is stored, what leaves the
  browser, threats and limits.
- [Development](./documentation/development.md): configured builds, provider settings and
  troubleshooting.
- [Decisions](./documentation/adr/): the choices that are hard to reverse.

## Repository layout

```text
apps/
  extension/        Chrome MV3 extension: worker, content script, popup, Options
  web/              otpguard.net (Next.js)
packages/
  otp/              email parsing and code extraction (@otpguard/otp)
  security/         candidate checks, timing and retrieval limits (@otpguard/security)
  shared/           message, settings and activity contracts (@otpguard/shared)
configuration/      public extension identity, Google and Clerk settings
scripts/            extension build, release build, review packaging, test fixtures
tests/              Playwright specs and checks on build output
documentation/      architecture, privacy and security, development, ADRs
.agents/skills/     skills for coding agents
```

Unit tests live in each workspace's `tests/` folder.

## Install in Chrome

The extension is not in the Chrome Web Store yet. Install it unpacked from a configured
build. A build from a fresh clone has no provider settings and cannot sign in or read
Gmail.

1. Build it: `bun run build:release /absolute/new/folder` (see [Commands](#commands)).
2. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and
   select `/absolute/new/folder/extension`. Pin OTPGuard to the toolbar.
3. Open [your dashboard](https://otpguard.net/dashboard) and sign in.
4. Choose **Connect this browser**. The dashboard shows the next setup step.
5. Choose **Connect Gmail** and approve read-only access to the mailbox that receives
   your codes. It can be a different address from your OTPGuard account.
6. Choose **Enable website access**. In the extension page that opens, choose it again
   and approve Chrome's prompt. Reload any login page that was already open.

Now open a page that asks for an email code. OTPGuard finds the code and shows **Fill**
in the popup. If automatic finding is off, choose **Find code** in the popup.

Each part of the product does a different job:

| Where             | What you can do                                                                    |
| ----------------- | ---------------------------------------------------------------------------------- |
| Popup             | See status, find a code, retry, and click **Fill**. Only the popup can fill.       |
| Website dashboard | Setup, Gmail connect and disconnect, automatic finding, site blocks, local history |
| Options page      | The same controls, plus Chrome's website-access prompt                             |
| Homepage          | A demo with a made-up code; no mailbox, sign-in or submission                      |

The dashboard only works with the extension in the same Chrome profile and the same
OTPGuard sign-in. It receives status and settings, never codes or mail.

## What it covers

Supported:

- Codes of 4 to 8 letters or digits, with case and leading zeros kept. A display like
  `ABC-123` fills as six characters.
- English code wording in plain-text or HTML email.
- Single code fields and split fields (one box per character) on HTTPS pages.

Not supported: iframes, shadow DOM, codes with symbols or more than 8 characters, magic
links, more than one mailbox, incognito windows and other browsers. If two different
codes could match, OTPGuard refuses instead of guessing.

Settings and history stay in your Chrome profile; there is no OTPGuard server. Signing
out of OTPGuard does not disconnect Gmail. Disconnecting Gmail asks Google to revoke
access for every client in the same Google Cloud project.

Before a public release, OTPGuard still needs Google's verification for the restricted
`gmail.readonly` scope and a Chrome Web Store review.

## Develop

### Prerequisites

- Node 22.19.0 (`.nvmrc`) and Bun 1.4.2
- Ports 3100 and 3001 free for browser tests
- On Linux, browser dependencies: `bun x --no-install playwright install --with-deps chromium`

### First run

From a fresh clone, with no provider env files:

```sh
bun install --frozen-lockfile
bun run build
bun run check
bun x --no-install playwright install chromium
bun run test:browser
```

Build before checking: some tests read the built extension and website. Every check
uses synthetic mail and fake providers, so no credentials are needed.

There is no hot reload for the extension. Run `bun run build`, then choose **Reload** in
`chrome://extensions`. The development build is in `apps/extension/build/chrome-mv3-prod`.

## Commands

Run these commands from the repository root.

| Command                                   | What it does                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `bun run build`                           | Builds the extension and the website                                          |
| `bun run check`                           | Typecheck, lint, format check and every unit test                             |
| `bun run --filter @otpguard/<name> test`  | Unit tests for one workspace: `extension`, `web`, `otp`, `security`, `shared` |
| `bun run test:browser`                    | Playwright specs against the built extension and website                      |
| `bun run build:release /absolute/new/dir` | Configured extension from `configuration/`, without reading env files         |
| `bun run format`                          | Formats the repository                                                        |
| `bun run dev:web`                         | Starts the website in development mode                                        |
| `bun run fixtures`                        | Serves the synthetic test pages on port 3001                                  |
| `bun run package:review`                  | Builds credential-free review archives in `dist/review`                       |
| `bun run check:packages`                  | Unpacks the review archives and checks them (needs `zip`, `unzip`, port 3201) |

Before each commit, a Git hook formats and lints the staged files and typechecks the
repository. CI runs the full build, every check, the browser specs and the review
packages on each pull request, and audits dependencies weekly.

## Deployment

- **Website:** Vercel, from `apps/web`. Git deployments are off, so deploy by hand after
  merging. Merging alone does not change otpguard.net.
- **Extension:** unpacked builds only, until store review. Use `bun run build:release`
  for a configured build, or env files for a local one (see
  [Development](./documentation/development.md)).

## Troubleshooting

### The build stops with "Rename PLASMO*PUBLIC*\* variables"

The extension's env variables now start with `OTPGUARD_PUBLIC_`. Rename the keys in
`apps/extension/.env.account` and `apps/extension/.env.gmail`, and in your shell if you
export them.

### Manifest tests fail after changing configuration

The tests compare the manifest with the configuration they see. Build again with the
same env files the tests use, or point `OTPGUARD_TEST_EXTENSION` at a release build.

### Browser tests fail to start

Ports 3100 and 3001 must be free; Playwright starts its own servers and does not reuse
yours. If Chromium is missing, run the browser install command from
[Prerequisites](#prerequisites).

### `bun audit` reports braces

`braces` has a known advisory (GHSA-vfj7-8cjw-p6xm) with no fixed release yet. It is
only used by the Next.js lint plugin. CI ignores it with
`bun audit --ignore=GHSA-vfj7-8cjw-p6xm`; remove the ignore when a fix ships.
