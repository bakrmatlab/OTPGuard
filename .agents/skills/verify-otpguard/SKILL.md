---
name: verify-otpguard
description: Choose and run the cheapest checks that prove an OTPGuard change works. Use before saying a change is done, or when asked to test, verify or check a change.
---

# Verify an OTPGuard change

Run only what the change touches, cheapest first. Never drive a browser yourself.
Stop at the first failure and read only the failing output.

| Changed                                                                              | Run                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/otp`, `packages/security`, `packages/shared`                               | `bun run --filter @otpguard/<name> test`, then `bun run --filter @otpguard/extension test` (the extension consumes them) |
| `apps/extension` logic (`pipeline/`, `gmail/`, `account/`, `settings/`, `activity/`) | `bun run --filter @otpguard/extension test`                                                                              |
| `apps/extension` content script, popup or Options UI                                 | extension tests, then `bun run build` and `bun run test:browser`                                                         |
| `apps/web`                                                                           | `bun run --filter @otpguard/web test`; for pages or dashboard, `bun run build` and `bun run test:browser`                |
| `scripts/build-*.ts`, `configuration/`, manifest code                                | `bun run build`, then `bunx vitest run --project repo`                                                                   |
| `scripts/package-review.ts`, `scripts/check-review-packages.mjs`                     | `bun run build`, `bun run package:review`, `bun run check:packages`                                                      |
| Dependencies (`package.json`, `bun.lock`)                                            | `bun install --frozen-lockfile`, `bun audit --ignore=GHSA-vfj7-8cjw-p6xm`, then `bun run check`                          |
| Docs only                                                                            | Nothing to run; check that links resolve                                                                                 |

Before handing off a code change, run `bun run check` once. It runs typecheck, lint,
format check and every unit test. CI runs the full browser suite on each pull request.

The browser suite needs ports 3100 and 3001 free and an existing build. Real Gmail,
Clerk and OAuth are never available in tests; everything is synthetic. A change that
needs a live account must say so instead of claiming it was verified.
