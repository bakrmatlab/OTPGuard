# otpguard.net authentication: review and deployment plan

October 4, 2026. One owner-requested authentication PR, based on origin/main
0576669d77f3447acda0d7c613cdfd88376e93ae. Proposed title:
`feat(auth): prepare domain-hosted Clerk sign-in and shared extension sessions`.
Local review only; production setup, DNS writes, hosting, backend deployment, GitHub
publication and merge have not been performed. PR #3 stays unmerged and independent.

## Result and session contract

The website provides standard Clerk /sign-in and /sign-up routes. Google appears
only if enabled and correctly configured in the production provider; no Gmail access
token is exchanged for a Clerk identity. Reopen the popup after website login. The
owner explicitly approved shared sign-in/sign-out in this chat, replacing the earlier
independent-session requirement for this scope. The selected browser-profile session
is shared; sign-out ends that session in both clients, not sessions on other devices.

Worker SDK clients are reconstructed, active sessions reloaded authoritatively, and
fresh tokens requested without application persistence. Cookie changes invalidate
bindings; local identity expires within 30 seconds. Connected operations revalidate
before and after asynchronous work. A failed remote logout is reported and locally
suspends account operations until retry succeeds. Restart is not remote revocation.
The read-only cloud check compares the server-validated subject with the fresh bound
user; it returns only a fixed status to the popup. It does not activate metadata sync.

The authentication build uses the stable public key and ID in
[domain-auth.json](../configuration/domain-auth.json). Account-only builds require Chrome 116+ for combined abort signals and add cookies,
storage, the exact Clerk host and optional exact Convex host. They add no Gmail
identity permission, OAuth client, page injection, external messaging, remote scripts,
header interception or webRequest permission. Default unconfigured builds retain
storage only and no network hosts. Future Gmail registration must match this ID;
the owner's existing .env.gmail is preserved and not silently migrated.

## Provider read-only findings

- Remote HEAD is main at 0576669; experiment branch remains intact.
- Exact OTPGuard Clerk app app_3KBe3x9pX5mSraXnBbuEybz7ucS has only a development
  instance in the Platform API readback. No production instance is established.
- Connected Vercel account and team bakr-matlabs-projects contain no project matching
  otpguard. No other project was changed.
- Owner identified Cloudflare registrar/DNS and Vercel hosting. Read-only official
  cf CLI 1.0.0-beta.12 inspection verified otpguard.net is active, unpaused and a full
  Cloudflare zone, with nameservers fay.ns.cloudflare.com and venkat.ns.cloudflare.com.
  The exact-zone DNS listing is an empty array: no records exist yet. Vercel/Clerk
  destination records, HTTPS/certificates and hosting remain unconfigured/unverified.
- Existing development Convex deployment does not establish production issuer/JWT
  acceptance. The production-only auth.config.ts is retained without the experiment's
  development issuer exception. No backend deployment occurred in this PR.

## Concrete setup to review before publishing

1. Create a Vercel project for bakrmatlab/OTPGuard, Root Directory apps/web, Next.js,
   Node 22.x, Bun 1.4.2; enable inclusion of source outside the root for workspace
   imports. [vercel.json](../apps/web/vercel.json) supplies frozen workspace install,
   app build and disables automatic Git deployments. Provider setup still requires
   explicit authorization; pushing this branch is not permission to deploy it.
2. Add otpguard.net as the canonical project domain. Obtain the actual DNS record
   from Vercel's domain settings and enter that exact record in Cloudflare. Do not
   invent an A/CNAME destination or replace unrelated existing records. No www host
   or alternate application origin is required by this PR.
3. Create a production instance on the exact OTPGuard Clerk application using
   otpguard.net. Review copied settings; retain CAPTCHA/password policies. Follow
   Clerk's extension guide for Native API requirements; enabling it in production
   changes bot-protection exposure and belongs in the reviewed provider action.
4. Obtain all Clerk-provided CNAME/email-domain records from its Domains page. Set
   Clerk verification records to Cloudflare DNS-only and verify certificates before
   acceptance. Expected Frontend API is clerk.otpguard.net; if the provider assigns
   a different origin, revise the reviewed configuration and revalidate it.
5. Merge the origin in [clerk-production-instance.json](../configuration/clerk-production-instance.json)
   into the production allowed_origins list, preserving any valid existing entries:
   chrome-extension://jfncecbkgdnhdppgpblbokkceflpmgif. This file is a desired-state
   fragment, not an instruction to overwrite provider policy blindly. Use exact app/
   instance targeting, readback, and no wildcard origins. Review the Clerk subdomain
   allowlist for the canonical website; middleware accepts https://otpguard.net only.
6. Enter the production Clerk public and secret keys in Vercel Production environment
   settings using provider tools or owner UI entry. Never place the secret in the
   extension or chat. Website sign-in/signup URLs are /sign-in and /sign-up; fallback
   redirect is /. Production keys must identify this exact application instance.
7. For Google sign-in, create/configure the owner's production Google social OAuth
   client with Clerk's exact supplied callback in provider UI. Gmail extension OAuth
   is a distinct registration and grant. Google authorization redirects may carry
   one-use authorization codes/state; audit the actual provider URLs without recording
   values. Do not call Google live acceptance achieved or relax the credential-URL
   contract automatically. Passwords, OTPs, client/session JWTs and Gmail tokens must
   never appear in URLs; any broader contract change requires owner review.
8. Build the auth-only extension using an ignored .env.account containing only public
   configuration, with all Gmail variables absent:

   ```text
   PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=<actual production public key>
   PLASMO_PUBLIC_CLERK_FRONTEND_API=https://clerk.otpguard.net
   PLASMO_PUBLIC_CLERK_SYNC_HOST=https://clerk.otpguard.net
   PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN=https://otpguard.net
   PLASMO_PUBLIC_AUTH_CONVEX_ORIGIN=<reviewed exact Convex deployment origin>
   ```

   From apps/extension, use `bun --env-file=.env.account run build`. The builder
   rejects incompatible existing Gmail extension identity; do not load .env.gmail
   for this authentication PR. Inspect the artifact permissions/CSP and stable ID.

9. Prepare the production-instance convex JWT template with audience convex and
   short lifetime (60 seconds); configure CLERK_JWT_ISSUER_DOMAIN to the exact
   production Clerk issuer on a separately approved Convex deployment. Review
   authProbe.ts and the issuer policy before deploying them. Do not copy the existing
   development issuer into production or run convex dev as a readiness check.

## Actual-browser acceptance after prerequisite approval

Use an isolated Chromium profile, no trace/video/screenshots, and no logging of URL
queries, headers or response bodies. Enter passwords/codes only in provider UI.

1. Load the auth-only extension and confirm the exact ID and permission list. Website
   signup (or provider-configured Google login) must complete in actual Chromium;
   bootstrap, Node requests and mocks do not satisfy this criterion.
2. Reopen the popup: website and extension must show the intended account. Run Check
   cloud identity: the read-only Convex subject must match a freshly reloaded Clerk
   session and no token/subject response body may be printed or retained.
3. Sign out in the popup: website must observe signed-out state on reload. Reopen the
   popup and cloud check must refuse. Repeat with website logout and extension refresh.
4. Revoke the selected session remotely; switch accounts on the website; expire the
   session; logout during a delayed probe; restart the worker. Each old binding/late
   reply must refuse. Failed remote logout must not claim success or recover local
   authority in that worker. Verify anonymous Convex rejection separately.
5. Inspect network URL parameter names (with values discarded), exact hosts, trusted
   storage keys and bundled CSP. No application cache of credentials, mail or OTPs;
   cookies remain browser/provider-owned. Google callback URL behavior requires its
   own acceptance and must not be inferred from email/password signup.

## Validation and acceptance

See [completion results](domain-auth-acceptance.md) for exact commands and results.
Live signup/login, shared logout, authenticated Convex exchange, production network/
URL behavior and Google acceptance are blocked/unverified pending the provider and
publishing prerequisites above. Synthetic tests prove bounded local logic, not a
working deployed login. Trusted SMTP receipt, sender/service templates, Gmail
retrieval, real autofill and cloud history remain closed.

The next review action is this single local PR and its concrete provider/deployment
plan. No next feature PR has been started. The owner-local ignored docs/design.md and
docs/implementation-plan.md were updated in this checkout; this tracked scope and
ADR0016 carry the same plan/session amendment in the review diff.

## Primary sources checked October 4, 2026

- [Clerk Sync Host](https://clerk.com/docs/guides/sessions/sync-host): production example
  uses the Frontend API host; installed SDK 3.1.90 cookie reader confirms that choice.
- [Clerk extension production guide](https://clerk.com/docs/guides/development/deployment/chrome-extension):
  production instance, Native API, stable extension origin and domain requirements;
  its general website-host wording differs from the dedicated guide.
- [Clerk production setup](https://clerk.com/docs/guides/development/deployment/production):
  owned domain, production social credentials, DNS-only Cloudflare CNAME verification.
- [Convex HTTP API](https://docs.convex.dev/http-api/): header authentication and /api/query.
- [Vercel monorepos](https://vercel.com/docs/monorepos/monorepo-faq): root-directory
  workspace access, [project configuration](https://vercel.com/docs/project-configuration):
  build/install commands and [Git deployment control](https://vercel.com/docs/project-configuration/git-configuration).
