# OTPGuard — Design Review

Reviewed October 3, 2026. The repository contained no implementation when reviewed.

## Assessment

The handoff is a coherent product brief with a sensible stack and a valuable local-first
constraint. It needs more precision before serving as a security specification.
[design.md](design.md) consolidates the brief into a working build design; conservative
new defaults remain proposed policy decisions. The original is preserved unchanged.

## Findings and resolutions

| Priority | Original sections | Finding | Working-design resolution |
| --- | --- | --- | --- |
| Critical | 12, 21 | Sender domain and branding do not authenticate mail; forged headers can also mislead | Require a justified receiver-authentication boundary; UNKNOWN until validated |
| Critical | 7, 13, 21 | Page context and asynchronous retrieval are not bound to a document | Background derives sender context; binds requests to account/tab/document/origin and rechecks before release |
| High | 13, 28 | Registrable-domain matching could authorize untrusted subdomains | Explicit HTTPS origins; subdomain policies only when justified |
| High | 11, 21 | Freshness and newest-email selection cannot prove challenge identity | Conservative time limits, supported templates, purpose checks, refusal on ambiguity |
| High | 14–16, 5 | Manual-fill/trust settings could bypass security | Same gates for manual fill; defer overrides and protection-off setting |
| High | 4, 10, 20 | OAuth flow, broad mailbox scope, and public-release requirements are unspecified | Chrome identity spike, gmail.readonly, explicit consent and verification gate |
| High | 6, 21 | Local processing and cleanup could imply guarantees they cannot provide | Explicit backend boundary; best-effort memory cleanup; page can read inserted value |
| Medium | 19, 20 | Metadata-only logging still exposes login history | Local default, opt-in cloud history, bounded retention and structured event fields |
| Medium | 5, 18 | Provider connection/device status could imply a cloud Gmail grant | Device-reported state with last-seen time; local grants and account transitions defined |
| Medium | 10 | Retry sequence and service-worker recovery are underspecified | Elapsed-time schedule, request deadline, caps, coalescing and safe restart behavior |
| Medium | 24, 36 | Gmail appears before the secure mock pipeline in one build order | Mock authorization pipeline first, then Gmail/Clerk feasibility spikes |
| Medium | 24, 28 | Important tests arrive only in the last phase | Tests and CI accompany the initial security/parsing pipeline |
| Medium | 8, 9, 16 | Input heuristics may target TOTP/payment fields; page itself may auto-submit | Email-flow evidence, bounded input support and accurate submission caveat |

## Platform evidence

Google documents gmail.readonly as restricted, and gmail.metadata excludes bodies.
Its scope guidance also distinguishes verification from security assessment based on
server handling/transmission. This makes public distribution a separate project gate;
we cannot promise an exemption before assessing the final data flows.
[Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
and [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

Chrome identity supports Google access-token acquisition and a managed token cache.
That makes it a reasonable initial Chrome-only choice; actual account selection and
reconnection behavior still need testing.
[Chrome identity API](https://developer.chrome.com/docs/extensions/reference/api/identity).

MV3 worker globals are lost on shutdown. Inference for this design: retry timers and
in-memory request state must not be treated as durable, and restarted work must obtain
fresh authorization.
[Service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Content scripts use isolated execution environments while sharing the page DOM.
Inference for this product: writing an OTP to a page input discloses it to that page.
[Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

RFC 8601 documents the trust boundary and forged Authentication-Results risk. A
matching header string is not sufficient evidence; our Gmail-specific provenance
rule requires investigation before production autofill.
[RFC 8601](https://www.rfc-editor.org/rfc/rfc8601).

The Gmail message resource exposes MIME payloads and internalDate. It does not
document a dedicated authenticated-sender verdict field; receipt time and sender
authentication need separate treatment.
[Gmail message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages).

Clerk documents extension/web session synchronization with a configured sync host.
The minimal sign-in host can precede the full dashboard; the actual permissions and
session transitions need an integration spike.
[Clerk sync host](https://clerk.com/docs/guides/sessions/sync-host).

## Recommended first build

Implement the local mock pipeline against deliberately permitted fixtures, with
navigation binding and mismatch rejection from the beginning. Separately investigate
Gmail sender evidence and OAuth before making public claims about verified senders.
Keep the selected stack; no architectural replacement is justified by this review.
