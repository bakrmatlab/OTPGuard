# ADR 0034 — Website management of this Chrome profile

October 6, 2026. The owner explicitly requested working website controls after
reviewing the dark UI. This expands the current unmerged UI scope and supersedes
ADR0033's website-without-a-bridge decision. No deployment is authorized.

Use Chrome external messaging from the exact configured HTTPS production website
only. The manifest has `ids: []` and a single exact origin pattern; the worker
further requires `/dashboard`, no query, a top-level browser-derived document ID,
frame zero and matching sender origin. Other extensions and all loopback origins
are excluded. No web-accessible resource or content-script bridge is added.

Every request includes nonsecret website Clerk user/session identifiers. They are
claims to compare against a fresh authoritative extension session, never identity
proof by themselves. Check the browser's current document and session before work,
inside queued preference/history writes and Gmail consent, and before returning
metadata. Reject account/session switch, logout, navigation and expired authority.
Permit one external request at a time with a 60-second authority deadline; the UI
bounds waiting at 90 seconds and requires reload after an uncertain timeout.
Pending work retains the worker lock until settlement; timing out never permits
parallel late mutations. Already-dispatched browser storage/provider actions cannot
be rolled back if the owner signs out during completion.

Allow only status, automatic finding, exact HTTPS blocks, Gmail connect/disconnect,
local history export/delete and opening Options. The website cannot request code
retrieval, pipeline status, Fill, retry, email confirmation, credentials, account
probe or trust overrides. The popup remains the only Fill authority.

Connect this browser explains the metadata shared with the page. Settings, blocked
origins, mailbox state/address, history count and the last sanitized result are
rendered in client memory. Export JSON is shared only on an explicit export action;
it contains the existing sanitized local-history contract. No backend request,
cloud synchronization, persistent website storage or telemetry is added. The exact
website and its scripts become trusted for these management operations. Production
XSS would affect these capabilities, so codes/tokens and Fill are excluded entirely.

Chrome's site-permission prompt remains in Options; the dashboard opens that page.
Use the existing browser-local Google consent/revocation flow, with its existing
account/mailbox lifecycle checks. Sign-out remains Clerk's website account control.

Alternatives: cloud synchronization introduces provider-policy/data-retention work
and cannot grant this browser Gmail authority. Keeping every control in Options
failed the owner's requested website workflow. An arbitrary-origin postMessage
bridge would unnecessarily broaden the boundary.

Validation: protocol and sender negatives, session/document invalidation, concurrency,
queued write/consent refusal and web transport tests; both builds and artifact
inspection. Real shared-session Chrome use is separately unverified under the
owner's no-computer-use instruction. The local credential-free preview shows
honest disconnected controls; the configured production site plus updated installed
extension is required for real management. See website-management-acceptance.md.
