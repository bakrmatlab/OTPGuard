# PR 1 local review

Proposed title: `chore: bootstrap OTPGuard workspace`

Branch: `codex/project-foundation`. This report records local acceptance before
publication. After reviewing the results, the owner authorized publishing and
merging PR 1 into [bakrmatlab/OTPGuard](https://github.com/bakrmatlab/OTPGuard).
GitHub CI results are recorded in the pull request checks.
The initially empty repository was initialized with the preserved planning documents
on `main`; the implementation follows in a separate foundation commit. Design and
workflow documents were preserved; the implementation plan’s package-manager and
milestone references were updated at the owner’s request. No PR 2 work was started.

## Result

A pinned Bun workspace builds a minimal Plasmo MV3 extension and Next.js landing
page. Both clearly state that Gmail and autofill are unsupported. Strict TypeScript,
ESLint, Prettier, Vitest, Playwright, credential-free CI, ignored generated artifacts,
and sanitized example configuration are present. No unused shared packages were
created. The architecture decision is recorded in
[ADR 0001](adr/0001-workspace-foundation.md).

## Acceptance evidence

| Criterion                             | Result                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fresh install from lockfile           | Passed in a separate temporary workspace with no node_modules                                    |
| Extension production build            | Passed, Plasmo 0.90.5, Chrome MV3                                                                |
| Web production build                  | Passed, Next.js 16.3.8, static landing page                                                      |
| Unpacked extension loads; popup opens | Passed in bundled Chromium and regular Chrome, including the pinned toolbar popup                |
| Web entry point opens                 | Passed against production Next.js server                                                         |
| Strict type, lint, format checks      | Passed for both apps and test/config sources                                                     |
| Meaningful smoke tests                | Passed: manifest permission guard plus two browser entry-point tests                             |
| Credential-free CI configuration      | Configured; local acceptance passed; GitHub execution is recorded in PR checks                   |
| Generated manifest review             | Passed: no API/host permissions, content registration, external resources, or external messaging |

## Exact checks

Run with Node 22.19.0 and Bun 1.4.2:

```sh
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run lint
bun run format:check
bun run test
bun x --no-install playwright install chromium
bun run test:browser
```

`bun run check` combines the four checks from typecheck through test. The clean-install
command was run in a fresh temporary copy of workspace manifests and lockfile.
Builds and checks were run against the implementation checkout on macOS arm64.
The Bun revision was checked using the pinned Bun 1.4.2 binary on PATH with
Node 22.19.0. Builds and Chromium execution needed local sandbox escalation.
The owner requested this change during PR 1 review; pnpm configuration and lockfile
were replaced with root workspace configuration and `bun.lock`.

Initial failures were fixed: a missing icon, an invalid empty match registration,
and missing Chrome ambient types in browser-test tooling. Plasmo defaults a
nonempty content entry to all-site injection, so the final entry is deliberately
zero bytes and its omission is tested. Plasmo retains upstream
deprecations and a htmlnano/SVGO peer mismatch. Bun installation and both builds
succeeded with the explicit four-package install-script trust list.

## Manual checks and security limits

Follow the [README production acceptance steps](../README.md#manual-production-acceptance).
The Chrome toolbar popup was manually verified on October 3, 2026: the production
extension loaded unpacked, was pinned, and displayed the expected foundation notice.
Chrome Details reported no special permissions and no additional site access.
A temporary local synthetic form retained its initial value with zero input events
and zero submissions; the fixture stayed outside the repository and production bundles.
The web page was also visually verified in regular Chrome and the in-app browser.
The production web server and pinned extension were left available for user review.
The automated popup test still opens its extension URL; the toolbar interaction is
separate manual evidence. Worker loading is automated, while a manual worker-console
inspection remains a suggested follow-up. No Google/Clerk/Convex credentials,
real mailbox, code, or token were used. There is no retrieval, fill, storage, or
backend integration. Production bundles have no synthetic adapters or site access.
Development hot reload is separate from the production manifest acceptance check.

The React component check found small static components, semantic headings/main
landmarks and explicit status text, no unnecessary client boundaries, effects,
SDKs, data fetching, analytics, or remote fonts.

The next logical PR is PR 2, OTP field detection, only after a separate user request.
