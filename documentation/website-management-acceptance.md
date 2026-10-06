# Website management acceptance — October 6, 2026

Proposed title: `feat(web): manage this browser through the authenticated extension`.
Owner-requested expansion of the current unmerged dark UI review on
`codex/dark-ui-implementation`. Local changes only; no commit, push, merge,
deployment, owner extension replacement or Google grant changes.

## Result

The approved dashboard now has explicit Connect this browser, current Gmail
status/connect/reconnect/disconnect, automatic finding, exact HTTPS site blocks,
local history count/last result/export/download/delete and a direct button to
open Chrome's owned permission screen. Account management/sign-out remains the
existing Clerk website account control. No cloud sync or OTP release is added.

Use the configured production website and updated stable-ID Chrome extension for
real operations. The provider-free local preview at http://127.0.0.1:4319/dashboard
shows the actual UI with disconnected controls and a sign-in link. There is no
loopback messaging/authentication exception or fabricated connected data.

## Acceptance

- Achieved: functional client controls call an explicit, bounded metadata-only
  protocol rather than explanatory dead-end panels.
- Achieved: production manifest allows one configured HTTPS website and no other
  extension IDs. Worker accepts only its exact top-level `/dashboard` document,
  matching origin, current document ID and a fresh authoritative shared Clerk
  user/session. Query-bearing pages, other paths, frames, HTTP, lookalikes,
  wrong ports, localhost, foreign extensions and malformed actions refuse.
- Achieved: page/session/account changes before work or during response collection
  refuse. Queued settings/history writes and Gmail consent recheck authority.
  A browser/provider write already dispatched may complete after logout; refusal
  cannot undo it. One external request at a time; no late concurrent retry after
  an uncertain client timeout. See ADR0034.
- Achieved: mailbox/preferences/history projections contain only approved metadata.
  History JSON crosses to the page only for explicit export. Website renders this
  in client memory; no backend, telemetry or persistent website storage was added.
- Achieved: pipeline status, retrieval, retry, email confirmation and Fill are
  absent from the website protocol. Popup remains the explicit Fill authority.
  Codes, mail and Gmail/Clerk tokens never enter website management messages.
- Achieved: default unconfigured review packages retain their old permission
  boundary with no externally_connectable manifest entry; configured artifact
  separately accepts only https://otpguard.net/* with ids: [].
- Unverified: live shared-session Chrome messaging, interactive Google consent,
  real installed extension controls, accessibility/visual browser checks and
  permission handoff. No computer/browser automation or owner-profile access was
  performed, following the owner's instruction. Unit/synthetic results do not
  establish live acceptance.

## Validation

All builds/checks ran in `/tmp/otpguard-dark-ui-review` with the existing pinned
validation dependencies, without reading owner environment files or rebuilding
owner artifacts. Bun: `/tmp/otpguard-runtime/bun-darwin-aarch64/bun`.

- Passed: `bun run check` — workspace/tools/Convex typecheck, ESLint, Prettier,
  **50 unit files / 809 tests**. New tests cover protocol/sender/session/document
  rejection, concurrency, response projection, external registration/dispatch,
  queued mutation/consent checks, missing extension and bounded web transport.
- Passed: `bun run build` — extension and Next production outputs.
- Passed: `bun run package:review` — refreshed website/extension ZIPs.
- Passed: Python HTTP/content inspection of `/`, `/dashboard`, `/help`, `/setup`;
  current management controls appear and all routes respond 200. This is not
  visual or browser interaction verification.
- Passed: ZIP SHA-256/size provenance, local fonts and default manifest inspection.
- Passed: configured extension build in
  `/tmp/otpguard-website-management-configured` using reviewed public JSON config,
  with exact externally_connectable projection and no content scripts or
  web-accessible resources. Initial `bun scripts/build-core-3.ts` export failed
  because that helper omits nested packages/otp dependencies. Copying the already
  pinned validation package dependency directory into the isolated export and
  rerunning `bun ../../scripts/build-extension.ts` with the same public-only
  config passed. No package versions or owner dependencies were changed.
- Passed: `OTPGuard_ARTIFACT=/tmp/otpguard-website-management-configured/apps/extension/build/chrome-mv3-prod bun node_modules/vitest/vitest.mjs run tests/manifest.test.ts`
  — five configured artifact/isolation checks.
- Passed: `git diff --check`.
- Skipped: `bun run test:browser` and `bun run check:packages` (browser automation),
  live provider actions, deployments and installation/replacement.

Earlier intermediate typecheck/mock failures were repaired before the final
passing run. The Next preview emits the existing standalone/start advisory;
HTTP checks pass. Network/process access needed only sandbox escalation for the
loopback server restart and HTTP reads; no automatic approval review rejected
an action.

## Owner acceptance steps after authorized installation/deployment

1. Load the updated configured stable-ID extension and updated configured site.
   Sign in at otpguard.net/dashboard, then Connect this browser. Confirm the
   mailbox status belongs to this Chrome profile.
2. Change automatic finding and add/remove https://example.com as an exact block.
   Check the same values in extension Options; reload the dashboard and reconnect.
3. Connect/reconnect Gmail through its Google consent screen; deny consent once
   and verify clear failure without a false Connected result. Disconnect only
   when intending the documented project-grant revocation.
4. Export/download sanitized history; delete it and verify the count becomes zero.
   No code, mail or token should appear in export.
5. Open the site-permission screen and grant/deny there; refresh the dashboard.
   Confirm Fill still happens only through the minimal extension popup.
6. Sign out/switch sessions or navigate during a delayed action. Reconnect only
   after signing in with the same session. Verify other origins/frames cannot
   issue management messages, and account changes discard displayed metadata.

Next step is owner review and separately authorized connected acceptance. No
following feature or publication is started by this report.
