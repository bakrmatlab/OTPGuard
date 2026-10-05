# Website authentication activation — October 5, 2026

The owner approved committing, merging and pushing the reviewed website UI/UX and
then requested working Clerk authentication. Website commit `e156a81ff71eda8c1e290599ea59099cea845feb`
was committed on `codex/website-ux-polish`, fast-forwarded into `main`, and pushed to
`origin/main`. `git fetch origin` confirmed main had not diverged. `bun run check`
passed type checking, lint, formatting and all 386 unit tests in 30 files. The prior
review also passed the isolated production build and eight browser cases.

## Deployment

Existing OTPGuard Vercel project `prj_ueLebYg0kSSwC3tIcWeSi0vilKli`, team
`team_tAOTSskycK9yZmtfriT9fOJI`, remains linked to `bakrmatlab/OTPGuard`, root
`apps/web`, Next.js and Node 22. Production Clerk environment variable names/scopes
and storage types were read back without printing their values. Production Google
configuration was inspected through the Clerk CLI; its enabled/authenticatable and
credential-presence booleans passed. No keys or provider settings were changed.

Created production deployment `dpl_AgHMdTo2vzSBfeN2BFtEsqmXdo3v` from the exact merged
Git SHA. The deployment-specific ignore command was `exit 1`, allowing this manual
build while preserving automatic Git deployment suppression. Vercel reported READY
and the matching Git SHA. A protected deployment fetch confirmed the new landing page,
then the existing `otpguard.net` alias was assigned to the new deployment. Previous
production deployment remains `dpl_FWAXBdMAAmNvt9qPF5pjgyAra7aN`.

The CLI `vercel curl` verification attempt failed without returning a usable response;
no success was inferred from it. The connected Vercel protected fetch succeeded, and
actual isolated Chromium verification of the canonical production origin followed.
Protection was not disabled. No temporary generated host was added to Clerk's allowed
origins or the application's authorized-parties list.

## Actual live Chromium results

Command: `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH bun live-auth-check.ts`
in `/private/tmp/otpguard-website-polish-review`. The local validation script uses the
repository's installed Playwright and a fresh, ephemeral Chromium context. It records
only fixed result messages; no screenshots, traces, video, credential values, response
bodies, headers, cookies or browser storage were captured.

- **Passed:** public `/` shows the feature landing and Get started opens `/sign-up`.
- **Passed:** configured production Clerk signup email field renders; no unavailable
  authentication message appears.
- **Passed:** configured production Clerk signin identifier field renders, with a
  Google sign-in button.
- **Passed:** anonymous `/dashboard` redirects to canonical `/sign-in`; Overview
  content is absent.
- **Passed:** no browser page errors during these checks.
- **Passed (owner acceptance):** the owner signed in through the live route and
  explicitly confirmed that the dashboard opens. Authentication method and account
  details were not collected.
- **Unverified:** completing a new signup/email verification, separate Google login
  acceptance, and the new dashboard's profile/logout interaction. The automated
  browser check created no account or provider session.

The existing shared extension session design, provider grants and privacy boundaries
are unchanged. Previous lifecycle/privacy deferrals still apply. No Gmail connection,
cloud synchronization, new site support or extension release is included.

## Reproduce

Visit https://otpguard.net while signed out. Use Get started for account creation or
Sign in for an existing account. Complete provider verification in its UI; successful
login uses `/dashboard` as the fallback destination. In a private browser window,
opening `/dashboard` should send you to sign-in. Signing into OTPGuard does not connect
Gmail. Do not paste passwords, verification codes or tokens into chat.
