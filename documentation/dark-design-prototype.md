# Dark design prototype — local review

Owner approved this direction and authorized its implementation on October 6, 2026. The subsequent scope and actual results are in
[dark UI implementation acceptance](dark-ui-implementation-acceptance.md).
The prototype below remains the approved visual reference.

October 6, 2026. Selected owner-requested, unnumbered design scope on
`codex/dark-design-prototype`, based on actual main `2d0e35c8f79f918b465f1f25a30a78f1643a27f9`.
Prerequisite CI [37423179101](https://github.com/bakrmatlab/OTPGuard/actions/runs/37423179101)
completed successfully for that same SHA. No commit, remote PR, push, merge,
deployment or functional rebuild is authorized.

## Review question

Does a focused, dark code-handoff interface work across the public homepage,
browser management and the Fill popup?

The owner selected one coherent direction, permitted polish, and explicitly
excluded computer use. This supersedes the prototype skill's multiple-variant
workflow. There are no alternate sites or variant switchers.

## Direction

The actual [Marathon site](https://marathonthegame.com/) was inspected before design.
Its large condensed type, black surfaces, sharp controls and vivid accents inform
the direction. OTPGuard uses original typography, a three-bar handoff mark and
code-field illustration; no game branding, assets or content are copied.

| Token      | Value     | Purpose                      |
| ---------- | --------- | ---------------------------- |
| Background | `#080b0b` | Dark only, including mobile  |
| Surface    | `#141919` | Popup and browser example    |
| Raised     | `#1b2221` | Secondary controls           |
| Text       | `#edf3e8` | Main copy                    |
| Muted      | `#a9b5ad` | Secondary copy               |
| Accent     | `#d0fa75` | Fill and installation action |
| On accent  | `#111807` | Dark button text             |
| Focus      | `#9ee4dd` | Keyboard outline             |
| Warning    | `#ffd28f` | Failure indicator            |

Big Shoulders Bold handles display headings. Instrument Sans handles reading and
controls. Fonts load locally, with licenses. The homepage pairs a left-aligned
headline with an original inbox-to-field illustration; the real interaction below
demonstrates Fill. Management uses rows rather than repeated dashboard cards.

The automatic UI/UX search suggested a generic light SaaS layout. Its touch-target,
contrast and focus guidance was useful; its palette, cards and generic feature
structure were rejected as incompatible with the owner's direction. A custom
theme is applied across all prototype views.

## Content structure and proposed copy

| Surface    | Keep                                                                                                                       | Remove or defer                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Homepage   | “Find the code. Choose Fill.”; concise product explanation; installation guide; synthetic Fill demo; one privacy statement | Slogans, feature grids, pilot marketing, placeholder metrics                         |
| Popup      | Current status; Fill when offered; Find/Retry when useful; “Open OTPGuard”                                                 | Account panels, mailbox labels, code previews, preferences, history, security jargon |
| Setup      | Local installation, account sign-in, Gmail consent, optional website access and candidate limitations                      | Fake store link, disabled connect actions                                            |
| Management | Separate account and Gmail state; automatic finding; website access; exact-origin blocks; local history                    | Cloud sync controls, devices and unsupported dashboard metrics                       |
| Activity   | Actual local results when a future browser connection exists                                                               | Fabricated live activity; cloud feeds                                                |
| Help       | Fill limitations, refusal guidance, privacy and disconnect explanation                                                     | Repeated promotional copy                                                            |

Main homepage copy: “OTPGuard finds a recent email code while you sign in. You decide
when it goes into the page.” Primary action: “Install for Chrome,” leading to the
local installation guide. No store availability is implied by a dead store link.

Popup copy:

| State        | Status                  | Explanation                           | Action        |
| ------------ | ----------------------- | ------------------------------------- | ------------- |
| Ready        | Ready to find           | Open an email code field.             | Find code     |
| Searching    | Finding a code…         | Checking recent email.                | Open OTPGuard |
| Candidate    | Code found              | None                                  | Fill          |
| No code      | No code found           | Request a new code, then retry.       | Retry         |
| Ambiguous    | Multiple possible codes | Use the code from your email.         | Open OTPGuard |
| Changed      | Page changed            | Return to the code field, then retry. | Retry         |
| Disconnected | Reconnect Gmail         | Open OTPGuard to reconnect.           | Open OTPGuard |
| Blocked      | Site blocked            | Manage blocked sites on OTPGuard.     | Open OTPGuard |
| Unsupported  | Field not supported     | Enter your code manually.             | Open OTPGuard |
| Expired      | Code expired            | Request a new code, then retry.       | Retry         |
| Replay       | Code already used       | Request a new code, then retry.       | Retry         |

“Code inserted” means insertion, never successful server authentication. “Code found”
does not assert verified sender identity or an email-to-site relationship.

## Isolation and implementation boundary

Files live in `apps/web/design-prototype/`, near the intended consumer, but outside
Next's App Router and public assets. This deliberate standalone exception avoids
the production Clerk layout, personal environment files and fragile owner build.
It runs with one Python static-server command. The sample popup is a website
component, not a rebuilt, installed or replaced extension.

All views show a persistent synthetic-prototype notice. Management adds a specific
notice that the website cannot read or change extension settings. It never silently
creates a browser bridge, cloud history, provider connection or grant. Controls
modify in-memory examples only; no network actions or persistence are present.

Actual account/mailbox/document/origin/field binding, release authority, refusal,
replay and privacy logic remain unchanged. The real extension still requires Fill.
The demo uses only `047291` in its own isolated field, after a click. No form,
submit control or submission code exists. Help explains that a website can read a
filled code and may continue automatically.

Removing setup controls from the real popup depends on a separately reviewed
same-browser management connection. This prototype does not remove the current
working controls or pretend that connection is implemented. Gmail tokens, mail and
codes must remain inside the extension in any future management implementation.

## Validation and acceptance

Passed checks:

- `gh run view 37423179101 --json status,conclusion,url,headSha`: completed,
  success, exact prerequisite SHA matched.
- `/tmp/otpguard-runtime/bun-darwin-aarch64/bun /tmp/otpguard-input-review/node_modules/eslint/bin/eslint.js apps/web/design-prototype/prototype.js`:
  passed with no diagnostics.
- `/tmp/otpguard-runtime/bun-darwin-aarch64/bun /tmp/otpguard-input-review/node_modules/prettier/bin/prettier.cjs --check apps/web/design-prototype/index.html apps/web/design-prototype/style.css apps/web/design-prototype/prototype.js apps/web/design-prototype/README.md documentation/dark-design-prototype.md`:
  all five files passed.
- Python standard-library HTML/content inspection: six templates, unique IDs,
  local CSS/script/font references exist, all navigation is local, no forms or
  submission controls, no provider/extension/storage calls. Reduced-motion and
  hidden-control rules are present. This is static evidence, not an interaction test.
- WCAG relative-luminance calculations: main text/background 17.48:1;
  muted/surface 8.37:1; muted/raised 7.63:1; primary button 15.22:1;
  notice copy 9.98:1; focus/surface 12.34:1. These are token-level checks, not a
  claim of full accessibility conformance.
- `curl --fail --silent --show-error --output /tmp/otpguard-design-served.html http://127.0.0.1:4318/ && cmp apps/web/design-prototype/index.html /tmp/otpguard-design-served.html`:
  served HTML matched exactly. Local server runs on loopback only.
- `git diff --check`: passed for tracked changes; all prototype additions remain
  untracked and uncommitted. Formatting separately checked those additions.

The initial sandbox denied binding the loopback server and blocked the loopback
read. Both succeeded after the authorized local-preview escalation. No automatic
approval rejection remains.

Production builds and unit/browser suites were not run: the static prototype is
not imported by production, changes no application behavior, and the owner build
must remain intact. No dependency installation was necessary.

Implemented for review: one coherent dark system, desktop/mobile CSS, homepage
demo, management page, four popup states plus refusal previews, concise final-copy
proposal, local fonts and explicit synthetic data. No production source changed.

Unverified: visual browser appearance, layout at actual device widths, keyboard and
screen-reader behavior, and live extension integration. The owner excluded computer
use; no browser inspection or screenshot validation is claimed.

Manual review: open the local prototype, choose Fill, confirm only the example field
changes, then Reset. Review Management, toggle finding, add/remove a synthetic block
and reload to confirm reset. Review Popup states and switch to ambiguity or blocking;
neither exposes Fill. Review at 375, 768 and 1440 pixels, tab through controls and
enable reduced motion. No live mailbox or owner browser profile is needed.

Stop for owner design review. A future approved scope can implement the chosen
visuals and separately define the management connection; neither is started here.
