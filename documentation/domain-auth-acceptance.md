# Domain-hosted authentication completion report

Initial local completion snapshot (superseded by the authorized deployment follow-up below).

October 4, 2026. Local branch codex/domain-clerk-auth, based on verified remote main
0576669d77f3447acda0d7c613cdfd88376e93ae. One review scope; no remote PR was opened,
no merge occurred and no provider/DNS/hosting/backend configuration was mutated.
Existing blocked PR #3 and its branch remain intact.

## Changes

- Standard website /sign-up complements /sign-in, with shared-session consequences
  visible in the website and popup. Google is provider-controlled and unverified.
- Existing production-only Clerk worker/Sync Host is retained, with authoritative
  session.reload before fresh token use and selected-session logout. Failed logout
  suspends this worker until retry succeeds; popup can retry and ignores stale probe UI.
- Auth-only build has a stable public key/ID without enabling Gmail permissions. Its
  exact origin is supplied as a provider desired-state fragment, not applied remotely.
- Optional read-only Convex subject check uses header-only fresh template JWTs, a
  10-second timeout/abort, 16 KiB response cap, exact origin and fresh identity checks
  around the query. Subject mismatch, stale session, revocation and late replies refuse.
- Vercel configuration and [Cloudflare/Clerk/Vercel plan](domain-auth.md) are concrete
  review artifacts. Automatic Git deployments are disabled in vercel.json.
- Architecture/privacy/threat notes and [ADR0016](adr/0016-domain-hosted-shared-auth.md)
  are updated. ADR0015 and failed-browser research are preserved as history, without
  the experiment's source, builder, staged signup or development issuer exception.
- Owner-local ignored docs/design.md and docs/implementation-plan.md were amended.
  The tracked domain-auth.md and ADR0016 carry that amendment for publication without
  importing the repository's entire ignored historical planning tree.

## Acceptance results

| Criterion                                                                 | Result                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Explicit shared website/extension session choice                          | Achieved: owner selected shared sign-in and sign-out in this chat                                             |
| Standard website sign-in/signup and no custom FAPI                        | Implemented; unconfigured routes verified in actual Chromium                                                  |
| Stable auth-only extension ID and narrow manifest                         | Achieved with synthetic public config in loaded Chromium; jfncecbkgdnhdppgpblbokkceflpmgif                    |
| Fresh identity, logout/revocation/switch/expiry/cancellation/late refusal | Achieved with synthetic worker/gate/probe tests; live provider behavior unverified                            |
| Convex authenticated identity derived from server and anonymous refusal   | Achieved in actual offline Convex test runtime; live production signature/issuer/audience exchange unverified |
| Website signup or Google through extension signed-in state                | Blocked: no production Clerk instance, hosted domain/certificates or Vercel project established               |
| Shared live logout, remote revoke/account switch and fresh Convex subject | Blocked/unverified pending approved provider configuration and actual Chromium flow                           |
| Production credential-URL/cookie/storage/network audit                    | Unverified; installed production SDK source uses header credentials, but no live login is inferred            |
| Google production login                                                   | Unverified; production social OAuth credentials and callback URL audit required                               |
| Gmail retrieval/real fill/cloud history remain closed                     | Achieved by source/artifact review and existing synthetic acceptance                                          |

## Exact validation

Build/check commands ran in fresh credential-free /tmp/otpguard-domain-validation with
Node 22.19.0 and Bun 1.4.2 using
`PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH`. Root .env.local,
apps/extension/.env.gmail and the pre-existing configured owner build were preserved.
The export excludes ignored provider files, browser profiles and generated artifacts.

| Command/check                                                                                                      | Outcome                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git ls-remote --symref origin HEAD`                                                                               | Passed: integration main and SHA verified, read-only                                                                                                                   |
| `bun install --frozen-lockfile --offline` with Bun 1.4.2                                                           | Passed: 294 cached platform packages; not a network clean-machine bootstrap claim                                                                                      |
| `NEXT_TELEMETRY_DISABLED=1 bun run build`                                                                          | Passed: Next.js website including signup and Bun MV3 extension                                                                                                         |
| `bun run --filter @otpguard/extension build` after final worker/UI edits                                           | Passed                                                                                                                                                                 |
| `bun run check` after final code edits                                                                             | Passed: workspace/tool/backend types, lint, format; 301 tests in 22 files                                                                                              |
| `bun run build:mock`                                                                                               | Passed: separate synthetic artifact                                                                                                                                    |
| `bun run test:browser` with local loopback servers and isolated Chromium                                           | Passed: 29 tests; 1 expected skip for configured Gmail fixture; traces/video/screenshots off                                                                           |
| Auth-only configured build with fabricated production-shaped public key and synthetic Convex host                  | Passed: cookies/storage, exact Clerk/Convex hosts, no identity/OAuth/content access; does not validate an assigned provider key                                        |
| Temporary isolated Chromium manifest check                                                                         | Passed: actual loaded stable ID and no Gmail/page access; no sign-in attempted or inferred                                                                             |
| `git diff --check` and local documentation link check                                                              | Passed after report creation                                                                                                                                           |
| Exact OTPGuard Clerk Platform API application read, minimized output                                               | Only development instance found; no production instance established                                                                                                    |
| `cf auth whoami`, `cf zones list --name otpguard.net`, `cf dns records list --zone <exact zone ID> --per-page 100` | Passed: authenticated read-only CLI; active, unpaused full zone; nameservers fay.ns.cloudflare.com / venkat.ns.cloudflare.com; zero DNS records, verified array result |
| Connected Vercel project read in available account/team                                                            | No OTPGuard project found; no unrelated project changed                                                                                                                |

Earlier checks and corrections: the initial checkout `bun run check` passed types,
lint and format but failed two artifact tests against the owner's stale 312 MB
configured build (wrong size/permissions). A fresh provider-free export resolved them.
The system Bun 1.2.22 could not parse lockfile version 2; the already available pinned
Bun 1.4.2 completed frozen installation. First sandboxed browser run could not start
its local web server; the same local-only suite with approved host execution passed.
These failed attempts are not represented as passing acceptance.

Owner-requested Cloudflare follow-up installed official cf 1.0.0-beta.12 under
/tmp/otpguard-cloudflare-cli, outside this repository, and completed its browser
login with account/zone/DNS/user read scopes plus refresh access. Credentials, login
codes/URLs and raw authentication responses were withheld. No DNS write scope was
requested and no record or provider setting was changed. The zone ID is used only
for exact resource targeting; no credential is embedded in repository configuration.

Tests added/extended: account-probe.test.ts tests actual backend anonymous/matching
identity, subject mismatch, revocation, account/session replacement, expiry, logout
abort/late response and bounded header-only transport; domain-auth-config.test.ts
checks stable SPKI/extension origin and narrow auth permissions; worker tests verify
server reload failure stops token use, no-cache behavior, exact session logout,
failed logout suspension and retry; foundation browser test covers unconfigured signup.

## Review boundary

Reproducible live success and failure steps, environment names, exact allowed origin
and staged provider actions are in [domain-auth.md](domain-auth.md). Publishing the
branch/draft PR requires owner authorization. Provider production setup and deployment
require their own explicit authorization after reviewing those concrete actions.
No live credentials belong in chat. No next PR, store publication, Gmail activation,
real sender claim or real autofill is authorized by these results.

## Provider setup follow-up — October 4, 2026

Clerk production instance and exact extension origin were created/verified. Five
Clerk DNS-only CNAMEs and Vercel's provider-issued project-specific apex CNAME were
added and read back in the exact Cloudflare zone. Vercel project/domain configuration
is prepared, with automatic Git deployment disabled and no deployment created.
Clerk DNS verification was requested and last reported in progress; TLS issuance
had not started. Secret transfer to Vercel was rejected by automatic approval review
pending explicit destination authorization. Live authentication acceptance remains
unverified. No production website, Convex deployment, merge or push was performed.

The owner subsequently explicitly approved credential transfer. Both Clerk variables
were securely configured in the exact OTPGuard Vercel project for production only;
metadata readback verified encrypted publishable-key storage and sensitive secret-key
storage. No values were printed or committed, and no deployment was created.

## Authorized production deployment — October 4, 2026

The owner reviewed the change and authorized the proposed production setup, website
and backend deployment, live acceptance and PR publication. No merge is implied.

- Clerk domain status: complete. All five CNAMEs, both authentication-host TLS
  certificates and mail DNS are verified by Clerk.
- Vercel deployment `dpl_FWAXBdMAAmNvt9qPF5pjgyAra7aN`: READY, production,
  source commit `5edffca`, Next.js 16.3.8, Node 22. Remote frozen install/build passed
  (Vercel selected Bun 1.4.1; earlier local checks used pinned 1.4.2).
- Explicit alias assignment and certificate issuance completed for https://otpguard.net.
  Public `/`, `/sign-in`, `/sign-up`: HTTP 200 over HTTPS. Actual browser rendered
  Clerk email/password sign-in and signup link.
- Convex production `grand-buffalo-545`: issuer set to https://clerk.otpguard.net;
  dry run succeeded with no deleted indexes; production typecheck/schema/deployment
  passed. The public read-only identity query rejects anonymous requests with
  AUTH_REQUIRED. No metadata-sync client or cloud-history policy was activated.
- Google configuration readback found enabled sign-in with empty client credentials.
  Disabled that unusable provider through the documented config API. Production
  Google OAuth client configuration and Google browser acceptance remain outstanding.
- Auth-only extension rebuilt in the temporary validation export with the actual
  public production key, exact hosts and production probe origin; secret excluded.
  Dedicated Chromium opened with verified stable extension ID. Owner credential
  entry is pending; authenticated identity, shared logout, reverse logout, remote
  revocation, account switch, expiry and credential-URL audit remain unverified.
- No live passwords, codes, tokens, private keys, mail, traces or screenshots were
  recorded. Existing local owner configuration/build was preserved.

The live test requires the owner to sign in directly in the dedicated Chromium
window. Provider DNS/HTTPS/backend setup success does not establish shared-session
acceptance. Existing offline 301-test and 29-browser-check results remain valid for
unchanged application code. Production deployment is independent of merging this PR.

## Owner-controlled live account check and logout correction

Owner completed email verification and signed in using regular Chrome Guest mode;
website signed-in state was observed. The initial CAPTCHA loading error was not
reproduced in Guest mode. Shared extension testing requires a regular profile,
because Guest mode cannot load extensions. No bot-protection setting was weakened.

After the owner signed into regular Chrome and approved installation at action time,
the auth-only extension was loaded alongside the preserved older Gmail-configured
extension. Its ID and exact Clerk/Convex site permissions were verified. The extension
recognized the website's same account, and its production cloud identity check
reported success. No JWT, verification code or response subject was printed or saved.

The first extension logout revoked the shared session: website reload showed signed
out. However, the extension reported SIGN_OUT_FAILED. Installed Clerk 6.37.0 invokes
browser navigation after server revocation when no sign-out callback is supplied;
a background worker has no window. The adapter now supplies an empty callback plus
the exact sessionId, preserving remote logout/error handling while avoiding navigation.
The boundary regression assertion failed before this change and passed afterward;
12 account worker/message/probe tests, all workspace/tool/backend typechecks and
changed-file lint/format checks passed. Production auth-only build passed and the
installed extension was reloaded. Corrected live logout and reverse website logout
still await owner-controlled reauthentication; do not infer their acceptance.
