# ADR0023 — Generic request timing, relevance, and retained insertion

Date: October 5, 2026. Owner-requested revision of the local generic-fill PR,
covering reliability blockers 1–7. No publication, merge, or deployment.

The owner requested broad email-code compatibility without site configuration.
Existing blanket decoder-failure refusal, separate retrieval clocks, exact maxlength
assumptions, and synchronous insertion acknowledgement broke ordinary flows.

Generic decoding accepts repeated nonsemantic delivery headers, standard charset
aliases, MIME parameter spacing, and unpadded base64. Generic bodies with no charset declaration decode once as
UTF-8; malformed bytes refuse, with no legacy-encoding guessing or replacement. Conflicting critical headers
and critical parameters still refuse. HTML markup remains within the 256 KiB raw
bound; each extracted text and the aggregate remain bounded to 32 KiB. Alternatives
are combined so a different code cannot silently disappear. Signed pilot behavior
remains separate and strict.

A decoder failure is ignored only when a bounded, readable subject and Gmail snippet
identify an explicit ordinary-mail category and contain no code/authentication cues.
Unknown or potentially relevant failures keep the cycle incomplete. This is a matching
heuristic: it cannot prove that unreadable content contains no code. Skipping every
failure would hide genuine competition; refusing every failure would let unrelated
newsletters block ordinary logins. Neither approach is used as the default.

The worker timestamps trusted local email-request gestures before the OTP form appears,
using no page-supplied time. Detection falls back to a 60-second lookback when no gesture
is observable. A replacement field group cancels the previous approval and requires a new Fill click
while preserving the same challenge window. Retry preserves that window up to a bounded age; resend creates
a fresh receipt boundary with one second of allowance. Polling has its own fresh
60-second deadline, while the query and selection share the same challenge boundary.
These timestamps do not identify a server transaction. Delayed delivery of an older
request after resend can still be indistinguishable from the newer request.

Selection excludes contradictory receipt times, numeric field constraints and explicit
recipient hints. Gmail dot/plus aliases are equivalent; masked or missing page recipients
supply no exclusion. If a candidate matches the browser hostname/sender-domain or a
corresponding subject brand, explicitly branded other-service mail can be excluded.
Opaque provider/generic mail remains unknown and participates in ambiguity. Sender and
subject hints are untrusted and forgeable, not VERIFIED evidence or a remembered mapping.
There is no newest-message tie-break. Unresolved competing requests/codes still refuse.

Detection bounds candidate inputs and nearby text independently of the page's unrelated
markup size. It recognizes ordinary text and wrapped split controls; maxlength is an
upper bound, while explicit exact patterns/minimums constrain allowed numeric lengths.
Iframe, shadow-root, alphanumeric and language expansion are outside this revision.

Insertion uses native setters and cancellable beforeinput/input/change events, validates
constraints and current fields between events, and preserves user/page changes. Production
acknowledges retained values after a 100 ms asynchronous check. It never rolls back,
retries insertion, submits a form or claims login acceptance. Sites can change fields
later or submit on their own; the bounded retained check cannot guarantee permanence.

All hints, mail, snippets and codes stay in volatile worker/content memory. No extra
permissions, provider scopes, backend payloads or persistent mail state are introduced.
Required extension-owned Fill confirmation and all lifecycle/replay gates remain.

Verification is recorded in generic-reliability-acceptance.md. Synthetic regressions
are distinct from owner-controlled live Canva/Clerk and broad coverage acceptance.
