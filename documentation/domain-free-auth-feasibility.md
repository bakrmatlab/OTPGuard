> Historical evidence preserved from blocked PR #3. The reproduction commands below
> apply to codex/independent-native-auth, not this branch. The replacement scope is
> [domain-hosted authentication](domain-auth.md). No experimental build code is ported.

# Domain-free authentication feasibility

Investigated October 4, 2026 against current first-party documentation/source and installed
Chrome Extension SDK 3.1.90. No credentials, user sessions or deployments were accessed or changed. A read-only
OTPGuard Native API settings lookup failed; it does not establish whether that API is
enabled. No provider setting was changed. Existing ADR0007/0007a constraints remain in force.

## Verdict

The standard Clerk development web + Chrome Extension Sync Host setup still fails the
no-credentials-in-URLs requirement. A custom independent native-client architecture is a
credible research candidate supported by first-party native transport source; it is not
an accepted Chrome integration and does not synchronize the authoritative web session.
Neither a proxy nor ordinary Convex configuration repairs that difference. No complete
compatible end-to-end development setup has been established in this investigation.

## Confirmed source evidence

The current extension request handler explicitly chooses by instance type: development
appends `__clerk_db_jwt` to the request URL; production adds a nonsecret `_is_native=1`
flag and an Authorization bearer value. Installed source still does the same in
`apps/extension/node_modules/@clerk/chrome-extension/dist/esm/chunk-RQHI25AD.js:131`.
Current client options expose storageCache/syncHost, not a supported transport override.
[Request handler](https://raw.githubusercontent.com/clerk/javascript/main/packages/chrome-extension/src/internal/utils/request-handler.ts),
[client options](https://raw.githubusercontent.com/clerk/javascript/main/packages/chrome-extension/src/internal/clerk.ts).

Clerk explains that the development-browser credential connects the local development
browser to FAPI and is transported through a query parameter. Browser and native client
credentials are distinct concepts; a response header name is not evidence that a
development-browser credential can be converted into a native client credential.
[Architecture](https://clerk.com/docs/guides/how-clerk-works/overview),
[SDK terminology](https://clerk.com/docs/guides/development/sdk-development/terminology).

**New evidence beyond the earlier notes:** current Expo native client construction uses
`_is_native=1` and an Authorization client-JWT header without a production-key conditional.
It reads returned Authorization values and defaults to MemoryTokenCache. This demonstrates
first-party native transport code that is not intrinsically production-only. However it
depends on React Native/platform machinery and uses SDK-owned internal hooks; importing
it into Chrome or copying the hooks is not a supported extension integration by itself.
It also initializes a native client rather than converting an existing browser client.
[Expo native client source](https://raw.githubusercontent.com/clerk/javascript/main/packages/expo/src/provider/singleton/createClerkInstance.ts).

The published FAPI specification describes browser/native access and form-encoded
requests. It lists a native header/flag authentication scheme, although its scheme names
still say ProductionNativeApp. Its existence plus Expo evidence supports asking Clerk
about a dedicated custom Chrome native client; it does not resolve supported development
semantics or authorize rewriting Sync Host credentials.
[First-party FAPI specification](https://raw.githubusercontent.com/clerk/openapi-specs/main/fapi/2021-02-05.yml).

## Alternatives and their limits

| Option                                   | Established behavior                                                                                       | Remaining incompatibility                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Standard extension development client    | Development-browser JWT in URL; no supported handler override                                              | Violates URL invariant before any proxy receives it                                                                                       |
| Frontend API proxy                       | Supported on development instances; forwards request URL/body/headers and adds server-secret proxy headers | No documented conversion or elimination of query credential, including upstream hop                                                       |
| Independent native client/custom sign-in | First-party native source uses header transport and memory token cache                                     | Supported Chrome adaptation, complete sign-in requests, authoritative refresh, web logout/switch coupling and restart behavior unverified |
| OAuth device grant                       | Device authorization/token polling use POST bodies                                                         | Browser verification still requires sign-in; OAuth grant lifecycle is separate from the Clerk browser session                             |
| Server-mediated session authority        | Backend `getSession(sessionId)` can fetch current session resource                                         | Does not supply safe browser authentication or a safe worker credential bootstrap by itself                                               |

The documented proxy forwards URLs; stripping a credential after arrival cannot prevent
exposure in the original client-to-proxy URL. There is no supported claim that `proxyUrl`
turns a development SDK into header-only authentication.
[Proxy guide](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi).

Device OAuth tokens can be retained only in worker memory, but that alone does not bind
them to web logout or account switching. OAuth access/ID tokens last one day and refresh
tokens have no expiry; these are not fresh evidence of an active originating web session.
The documentation does not promise that browser logout automatically revokes the OAuth
grant. Verification/consent navigation also needs a URL audit.
[Device grant](https://clerk.com/docs/guides/configure/auth-strategies/oauth/device-authorization-grant),
[OAuth lifecycle](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth).

A narrowly scoped server broker could verify JWTs, then obtain current session status
with BAPI before sensitive operations. The backend secret must stay server-side and
never enter the extension. This is a possible authority component, not a complete sign-in
solution or proof of active browser-client selection: a session can remain valid while a
browser selects another session. Additional client/session binding is necessary.
[getSession reference](https://clerk.com/docs/reference/backend/sessions/get-session).

Convex's supported Clerk integration validates the configured issuer and `convex` audience
using a Clerk JWT template and an authenticated client/provider. The dev deployment can
host this integration without purchasing a domain. It does not make upstream Clerk
development authentication URL-free, nor independently detect web logout beyond token
refresh/rejection. Do not substitute an OAuth access token for the Clerk template token
without a separately specified resource-server integration.
[Convex Clerk integration](https://docs.convex.dev/auth/clerk).

## Actionable next step

The root investigation also ran `/tmp/otpguard-dev-transport-probe.mjs` against the exact
installed request-handler seam with synthetic credentials and no network. Both an
`.invalid` host and a `vercel.app` host received the development JWT query and no
Authorization header; the production control used a header and no credential query.
This confirms host choice does not repair that handler. It is not a full SDK sign-in,
redirect, storage or live-provider acceptance test.

The native candidate has concrete API primitives: the FAPI specification exposes session
retrieval, active-session touch, session end, and POST creation of a token using a named
JWT template. An adapter could use those to check its own fresh session, obtain only the
minimal `convex` template token, and end its own session on sign-out. Those endpoints
are not evidence that a browser client's session selection is synchronized automatically.
[FAPI session endpoints](https://raw.githubusercontent.com/clerk/openapi-specs/main/fapi/2021-02-05.yml).

Retain disabled standard development auth while obtaining provider-supported evidence
for the following concrete candidate: a dedicated native Chrome worker client against
the existing development FAPI, performing custom sign-in directly, using only header/body
credentials and a memory token cache, followed by fresh authoritative client/session
refresh before retrieval and again before release. Worker termination must require new
authentication; no copied JWT or persistent fallback. Full custom sign-in includes MFA,
denial, errors and cancellation and must not send passwords or session tokens through
page/content-script bridges.

If Clerk confirms this client type, first build a synthetic transport/session harness and
pin reviewed provider source. Test every URL and redirect across initial sign-in, refresh,
Convex-template acquisition, logout and restart; test revoked sessions, account change,
late responses and offline state. Only then attempt owner-controlled live acceptance.

This candidate requires an explicit account model decision: either maintain existing
web/extension same-session synchronization through a documented compatible binding, or
approve independent native login with accurately labeled dashboard sessions. The latter
changes the current design rather than satisfying web logout/switch synchronization by
assumption. No such model change is approved by this research note.

The separate trusted-SMTP-receipt requirement remains unchanged. Even a successful account
transport investigation does not authorize real code retrieval/fill without sender,
receipt, service-template and current-document acceptance evidence.
