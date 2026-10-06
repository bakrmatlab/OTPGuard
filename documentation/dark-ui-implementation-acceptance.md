# Approved dark UI — implementation review

Selected owner-requested scope, October 6, 2026:
`feat(ui): implement approved dark website and focused Fill popup`.
Branch `codex/dark-ui-implementation`, based on main `2d0e35c`.
The owner approved the prototype and explicitly requested implementation in the
same chat. No commit, push, PR publication, merge or deployment was requested.

## Result

- Website: approved homepage, synthetic explicit Fill demonstration, setup and
  help/privacy pages, dark account dashboard, sign-in/sign-up and 404 surfaces.
- Popup: current status, Fill only for a current offer, Find/Retry or explicit
  email-flow confirmation when appropriate, and a real Open OTPGuard website link.
  No account panels, code previews, history, preferences or progress disclosures.
- Full-page extension Options: actual account/Gmail controls, optional website
  access, automatic finding, exact-origin blocks and local history export/deletion.
- No fabricated connection/activity state on the website, no disabled cloud
  feature controls, and no claims that generic matching verifies sender-to-site
  trust. Installation points to the actual local-package instructions rather than
  an unavailable store listing.

The website cannot manage local extension state. It directs users to the Options
page (right-click OTPGuard's toolbar icon). This preserves the approved popup
hierarchy while keeping working local setup and management. A future website
connection remains a separate reviewed scope. See
[ADR0033](adr/0033-dark-ui-with-owned-browser-management.md).

## Boundaries

The worker accepts management messages only from the exact owned Options URL and
keeps pipeline actions popup-only. Existing account/mailbox/document/origin/field
binding, authority, explicit Fill, conservative refusal, replay and privacy logic
remain mandatory. No additional Chrome permissions, provider grants, cloud
history, website messaging or external-resource access. The extension never
submits forms. The only synthetic code in production UI belongs to the clearly
labelled website demonstration; extension bundles contain no demo adapter or code.

The owner environment files, ignored planning documents, generated extension
build and authentication/Gmail configuration were preserved. New builds use only
the provider-free source copy at `/tmp/otpguard-dark-ui-review`. Its pinned
dependency tree was copied inside that directory to satisfy Turbopack's filesystem
root restriction. No dependency versions or lockfile changed.

## Validation

Final results below are from the isolated provider-free copy. All application commands
run in `/tmp/otpguard-dark-ui-review`, with Bun 1.4.2 from
`/tmp/otpguard-runtime/bun-darwin-aarch64/bun`.

| Check                                             | Actual result                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`                                   | Passed: workspace/tools/Convex typecheck, lint, formatting, 47 unit files / 794 tests                                                                                   |
| `bun run build`                                   | Passed: Next.js production routes and MV3 extension                                                                                                                     |
| `bun run --filter @otpguard/extension build`      | Passed after the final popup-state module split                                                                                                                         |
| `bun run package:review`                          | Passed: credential-free extension/web ZIPs and provenance                                                                                                               |
| Read-only local HTTP checks                       | Passed: homepage, dashboard, setup, help, sign-in, sign-up, local font and custom 404                                                                                   |
| Offline artifact/archive checks                   | Passed: exact Options entry, original permissions, no external messaging/WAR, no extension demo code or management Fill path, archive hashes and bundled fonts/licenses |
| `git diff --check`                                | Passed                                                                                                                                                                  |
| `bun run test:browser` / `bun run check:packages` | Not run: owner excluded computer use; browser/native/interaction acceptance remains unverified                                                                          |

Production preview: http://127.0.0.1:4319, using only the isolated unconfigured
website. Local review archives are `/tmp/otpguard-dark-ui-review/dist/review/web.zip`
and `/tmp/otpguard-dark-ui-review/dist/review/extension.zip`. No configured owner
artifact was replaced. The older approved prototype remains at port 4318.

Initial checks exposed validation-environment issues: workspace dependency links
were missing and Turbopack refused dependency symlinks outside the copy's root.
Both were resolved within the isolated validation copy. One unit command was
mistakenly run in the owner checkout; it failed on the known `entities/decode`
dependency gap and configured artifact expectations. No owner build was run or
replaced. The corrected isolated unit suite passed.

## Acceptance and review

Owner follow-up: show the approved popup-state showcase on the website. Added
`#extension` to the homepage with Ready, Searching, Code found and No code examples,
desktop/mobile layouts and links to the synthetic Fill demo. The section is
explicitly labelled Synthetic states; it reads no extension data. Updated preview
verified over HTTP. Web production build, web typecheck, affected JSX lint and the
five existing homepage/dashboard unit tests passed. Browser checks remain unrun.

Implemented: the single approved visual direction, dark-only surfaces, responsive
layouts, minimal popup, useful website content, functional local management and
unchanged release/privacy gates.

Unverified: browser visual/interaction acceptance, native popup dimensions,
keyboard/screen-reader acceptance and live provider flows. The owner explicitly
excluded computer use; browser tests were updated for the new surfaces but not
executed. Static/source and unit checks do not replace these results.

Manual review: run the provider-free website, review at 375/768/1440px, choose Fill
in the labelled synthetic demo and Reset. Load only the separate provider-free
extension artifact in a disposable Chrome profile; open Options from the icon's
context menu. Confirm preferences and blocks persist across reload, export/delete
local history, and inspect account/Gmail unavailable states. The popup shows no
Fill in those states. No owner mail/profile is needed.

Stop for owner review. The production deployment and installed owner extension
are not replaced by this local implementation.

## Owner-requested functional website management follow-up

The owner subsequently requested that website settings/history/mailbox controls
work directly. The same unmerged review now includes the exact-production-origin,
shared-session/document-bound bridge under ADR0034. This supersedes this report's
earlier no-website-bridge limitation. Current checks and live-acceptance limits are
in [website management acceptance](website-management-acceptance.md).

## Owner-requested spacing review

October 6: reviewed shared website CSS and page/component markup for homepage,
three dashboard panels, setup, help, sign-in/up and the shared footer. Corrected
inconsistent 1500/1600px containers and gutters, excessive footer/workspace blank
space, missing row-action gaps, full-input minimum height inherited by checkbox,
block-form label alignment, account/setting text rhythm, adjacent sidebar groups,
uneven popup cards and narrow/tablet demo layout. Uses shared fluid gutter/section
spacing while retaining the approved palette, typography and all behavior.

Passed in the isolated review copy: `bun run --filter @otpguard/web build`,
`bun node_modules/prettier/bin/prettier.cjs --check apps/web/app/styles.css`,
`bun node_modules/vitest/vitest.mjs run apps/web/app/home.test.ts apps/web/app/dashboard.test.ts`
(two files/five tests), and `git diff --check`. Updated the existing loopback
preview and review archives. No browser/computer-use or rendered visual check was
performed under the owner's instruction; responsive layout is source-reviewed,
not claimed as visually verified. No live deployment or extension change.
