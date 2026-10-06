# Guided setup follow-up — October 6, 2026

Owner-requested local scope on `codex/guided-setup` from deployed `7b1e02a`.
The owner confused Gmail connectivity with missing website permission. The dashboard
now derives four setup steps from authenticated identity and observed browser metadata:
sign in, connect this browser, connect Gmail, enable website access. Ready requires
confirmed Gmail and website permission. Automatic finding off is explained separately.
A click alone never marks a step complete; denied consent and missing permission remain
in setup. Account changes and failed transport discard the snapshot as before.

The dashboard refreshes metadata when focus returns after explicit connection, so
Chrome permission changes advance setup without a manual page reload. It does not
connect before consent, automatically request Gmail grants, or grant site access.
Existing pending-action and uncertain-timeout guards remain in place.

Popup setup blockers have named Sign in / Connect Gmail / Enable website access
buttons. Gmail and permission actions open the extension's full-page Options, which
places the remaining action at the top. Permission requests still require a click
in extension-owned UI. The website setup guide points to the guided workspace.
Advanced settings remain accessible; setup does not lock users into a tutorial.
Required Fill, session/document binding, provider checks and metadata-only bridge
are unchanged. No new privileges, cloud state, codes or credentials cross the bridge.

Validation results are recorded below after checks. Real Chrome permission/Google
consent and visual browser checks remain owner-controlled under no computer use.
This follow-up does not publish, merge, deploy or replace the installed extension.

Validation: in `/tmp/otpguard-dark-ui-review` with pinned Bun 1.4.2 and existing
pinned dependencies, `bun run check` passed typecheck, lint, formatting and all
813 tests in 52 files; `bun run build` passed both production builds. New tests
cover separate Gmail/site-access readiness, permission loss, mailbox failures,
named popup actions and the continued Fill-only live-offer path. Existing browser
smoke selectors reflect the new visible action labels; browser execution remains
unverified under the owner's no-computer-use constraint. `git diff --check` passed.
The owner checkout's pre-existing missing `entities/decode` dependency prevented a
check there; validation used the isolated dependency-complete review tree.

Owner spacing follow-up: retain guided setup on the website and extension. Options
uses consistent 32px desktop / 24px mobile gutters, removes forced row height,
groups account actions, separates help/status text from dividers, increases row
copy readability and stacks rows/actions on small screens. Both setup cards use
explicit 12px content gaps. Permission feedback appears once beside the setup
control. Verification uses checks/builds and source review; rendered spacing across
real Chrome viewports remains unverified under no computer use.

Release authorization: owner subsequently requested commit, merge, push and deployment.
Homepage cleanup removes the specified extra copy and Synthetic demo/states badges;
the interactive example retains its made-up-code explanation. Final local checks
passed all 813 tests, types/lint/format and both builds. Configured extension rebuilt
with existing public provider configuration; browser CI and production checks follow
publication. No provider configuration or account grants changed.
