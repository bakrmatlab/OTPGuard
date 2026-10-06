# Website Coming soon and setup follow-up

Owner-selected local scope, October 6, 2026, on `codex/chrome-coming-soon`.
Install for Chrome opens `/install`, explaining that public installation is coming
soon. The owner requested removal of the workspace link there, showcase footer
links, the boxed demo logo and the Extension eyebrow. Showcase cards use a 240px
minimum height and tighter spacing. The made-up-code demo remains interactive.

Owner subsequently requested complete guided setup states. Both website and
Options use shared setup progress derived from observed mailbox/permission/settings
state. Existing setup explicitly says Setup complete. Automatic finding off is a
completed manual configuration. Loading, Gmail consent/disconnection, reconnect,
missing scope, account/mailbox change, unconfigured build, unconfirmed revocation,
cache cleanup failure, unknown mailbox status, missing website permission and
unavailable preferences have separate guidance/actions. Unknown/read failures never
show completion. The website still requires explicit Connect this browser before
reading extension metadata. No new transport, grant or Fill authority is introduced.

Validation in the isolated pinned review tree: `bun run check` passed types, lint,
formatting and 814 tests in 52 files. `bun run build` passed both builds. State tests
cover all current mailbox enums, unknown state, existing setup, manual finding,
loading, unreadable local settings and lost permission. `git diff --check` passed.
Live provider/Chrome and visual checks remain unverified under no computer use.
These changes remain local for owner review; no publication is authorized.

The owner subsequently authorized deploying this scope. The release includes the
Coming soon route, requested homepage cleanup, compact cards and shared complete
setup states. Browser CI validates the Install link, Coming soon page and return
to the demo before production domain assignment.
