# Production Clerk Google login

October 4, 2026. Owner selected Google login as the first step toward a real local
end-to-end OTP journey and explicitly authorized creation/configuration of the
production social connection. Branch: `codex/google-clerk-login`, base `68957e2`.
No application code changes, merge, push or website/backend deployment in this scope.

## Provider changes and checks

- Checked installed Clerk CLI and Google Cloud SDK commands first. Clerk config
  patch supports the production connection. gcloud IAM OAuth clients are workforce
  federation clients with Cloud scopes, not Google Auth Platform web social clients;
  official Google/Clerk guidance uses Cloud Console for this client creation.
- Created one web client, OTPGuard Clerk production sign-in, in existing project
  `otpguard-20261003`: origin https://otpguard.net, redirect exactly
  https://clerk.otpguard.net/v1/oauth_callback, matching the production Clerk dashboard.
  Earlier Zen request stalled; subsequent Chrome inventory showed only the old
  extension client before successful creation. No successful duplicate observed.
- Downloaded Google-issued JSON to owner Downloads, outside the repository. Secret
  redacted from all browser output. Owner-authorized transfer used CLI from a temporary
  mode-0600 patch file, removed after execution; no secret in command arguments,
  documentation or repo environment files. Google client and existing Gmail client
  remain separate. Downloaded credentials remain owner-local and need secure handling.
- Clerk `config patch --app <exact app> --instance <exact production instance>
--file <private temporary file> --yes` succeeded. Readback confirms enabled,
  authenticatable, correct client ID and nonempty client secret; email-subaddress
  protection remains enabled. Secret readback differs from input, so byte equality
  is not asserted. Final owner Google callback and fresh identity probe passed as recorded below.
- Actual production https://otpguard.net/sign-in renders Continue with Google.
  Selected owner account reaches Google's consent screen for otpguard.net with
  name/profile picture and email only. No Gmail scope requested. Query values omitted
  from browser observations. No secret/session JWT captured or recorded.
- Google creation UI reports Testing and test-user restrictions. No audience
  publication or verification-status change made. Initial controlled owner acceptance
  is separate from public availability.

## Acceptance

| Criterion                                                              | Result                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Production provider configured through supported Clerk CLI             | Passed configuration/readback                                               |
| Google button on deployed website                                      | Passed actual Chrome                                                        |
| Correct Google app/account chooser and basic identity consent          | Passed actual Chrome                                                        |
| Google consent and callback create/authenticate intended Clerk account | Passed: owner completed Google consent; callback returned signed-in website |
| Extension recognizes Google-authenticated selected account             | Passed: exact production auth extension matches website account             |
| Fresh Convex identity with Google session                              | Passed on repeat; initial check refused                                     |
| Both logout directions with Google session                             | Not repeated; prior email-session acceptance remains separate               |
| Full callback credential/network/storage audit                         | Unverified; no blanket privacy acceptance inferred                          |
| Public Google availability                                             | Unverified; project currently Testing                                       |

Owner completed provider consent directly. Passwords, codes and CAPTCHA never
belong in chat. Website/extension identity and fresh Convex check passed as recorded
below; both logout directions with this Google session remain follow-up acceptance. No new Gmail permission,
real-mail retrieval, sender trust, site injection/fill or cloud history enabled here.
Those are the remaining parts of the user's end-to-end goal.

Sources: [Clerk production Google connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google),
[Google client management](https://support.google.com/cloud/answer/15549257),
[gcloud IAM client scope](https://docs.cloud.google.com/iam/docs/workforce-manage-oauth-app).

## Owner-controlled live follow-up

Owner completed Google's consent directly. Actual Chrome returned to otpguard.net
with a signed-in Clerk account. The production auth extension
`jfncecbkgdnhdppgpblbokkceflpmgif` recognized that same account (IDs compared locally,
only boolean equality recorded). Its fresh production Convex identity check passed
on retry. No raw JWT, authorization code, password, email or account ID is included
in this report. The shared session remains active for subsequent controlled Gmail work.

The toolbar initially opened the preserved old Gmail extension
`gifhbgecaldcelehjbdajpmigniehlpi`, which has no Clerk config. That artifact was not
modified or mistaken for the production authentication extension's acceptance. The
correct extension's first status check refused; reloading and allowing the authoritative
check to complete produced signed-in state. First Convex check returned unavailable;
repeat passed. Those transient refusals are retained as actual failure observations,
not silently counted as passes. No stable reproduction or diagnosed root cause,
no runtime workaround or weakened gate is claimed. Full latency/lifecycle acceptance
remains outstanding. Follow-up uses the diagnosing-bugs skill for further diagnosis
if a reproducible failure returns; no speculative code repair was made.

This completes basic Google → Clerk website → shared extension → fresh Convex identity
acceptance. It does not establish Gmail consent/retrieval or any real OTP fill.
Documentation formatting and whitespace checks passed; no application build/test was
needed because no application code or dependencies changed. No merge, push or
deployment followed provider configuration.

## Publication authorization

Owner reviewed basic live results and authorized commit and push to main together
with the simplified [core-first plan](core-implementation-plan.md). That publication
does not enable real-mail retrieval/fill or deploy code.
