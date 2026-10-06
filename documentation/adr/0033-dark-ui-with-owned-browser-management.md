# ADR 0033 — Dark UI with extension-owned browser management

Date: October 6, 2026. Status: implemented locally for owner review.

The owner approved the dark prototype and then authorized implementing it. The
popup must focus on the current Fill action, while local setup, preferences and
history remain usable. The website has no connection to extension-local state.

Use the approved dark system on the website, authentication surfaces, popup and
a full-page extension Options screen. Website account controls use the existing
Clerk session. The website accurately directs users to Options for local settings
instead of displaying invented Gmail state or nonfunctional controls.

Register `management.html` through `options_ui`, open in a tab. Permit only its
exact extension-owned URL to use the existing account/Gmail/settings/history
messages. The worker refuses its pipeline status, retry, email confirmation and
Fill requests. Popup foreground authority remains unchanged. No
`externally_connectable`, web-accessible resources, extra permissions, website
storage bridge or cloud transport is introduced.

Alternatives: retaining management inside the popup would defeat the approved
minimal interface. A website bridge would create an additional origin and data
boundary requiring a separately reviewed scope. Removing local controls would
break connection, consent and disconnect workflows.

Consequence: browser management lives in a browser-owned tab for now. The website
explains how to open it by right-clicking the extension icon and choosing Options.
Only the popup can initiate explicit Fill. Gmail tokens, email and codes remain
inside the extension; the management tab receives existing sanitized status and
local history export only. Account sign-out and settings changes preserve the
existing coordinator invalidation behavior.

Verification: exact-page/foreign-page/query-spoof rejection tests, popup offer
gating tests, existing lifecycle/privacy/parser/insertion tests, type/lint/format
checks, provider-free production builds and package inspection. Browser tests are
updated, but remain unrun under the owner's no-computer-use instruction. Live
provider, native popup and screen-reader acceptance remain unverified.

October 6 follow-up: the owner requested functional website management. ADR0034
supersedes the no-website-bridge decision within this same unmerged review; the
minimal popup and owned Options fallback remain.
