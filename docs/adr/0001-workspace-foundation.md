# ADR 0001: Credential-free workspace foundation

Status: accepted for local PR 1 review. Date: October 3, 2026.

## Problem

Establish compatible, reproducible web and extension entry points without enabling
mail access or site injection before their security boundaries exist.

## Decision

Pin Node 22.19.0 and Bun 1.4.2, commit the lockfile, and use workspace scripts.
Use Plasmo 0.90.5 with React 18.3.1 and Next.js 16.3.8 with React 19.2.4.
Keep dependencies scoped to each app. Use strict shared TypeScript options,
ESLint 10, Prettier, Vitest, and Playwright's bundled Chromium persistent context.
Do not create empty shared packages or add Clerk/Convex SDKs yet.

The content entry stays zero bytes: inspection of Plasmo's installed manifest
builder shows that it skips zero-length entries, while a nonempty entry without
config defaults to `<all_urls>` and `matches: []` creates an invalid registration.
The production manifest guard requires no content registration or permissions.
The background worker is inert and UI explicitly labels capabilities unavailable.

The owner requested Bun during PR 1 review, superseding the initial pnpm choice.
Bun uses root `workspaces`, `bun.lock`, and an explicit `trustedDependencies` list
for the same four native install-script packages. Node remains the CLI runtime.

## Alternatives and consequences

A single React version would introduce unnecessary compatibility coupling between
Plasmo and Next.js. An orchestrator and shared UI package add no value for two
small entry points. Broad or synthetic host matches would grant premature site
access; an empty entry avoids that and deliberately defers injection verification.

Permission-free production output has no identity/storage/scripting permissions,
host access, or registered content scripts. Plasmo development output can include
hot-reload code and its development CSP; load production output for acceptance.

## Verification

Both production builds and browser smoke tests run locally on macOS arm64.
The extension loads in Playwright Chromium and its popup opens. Manifest tests
protect the absent site-access boundary. See the PR 1 review report for exact
commands and limitations. This follows the
[Playwright extension guide](https://playwright.dev/docs/chrome-extensions) and
[Bun workspace model](https://bun.sh/docs/pm/workspaces).
