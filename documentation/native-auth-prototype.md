# Independent native authentication prototype

October 4, 2026. Owner-requested follow-up to the account and sync milestones.
This is a separate, explicitly built development extension, not a production auth
replacement. The owner approved independent extension and dashboard sessions:
dashboard logout does not automatically log out the extension. The ordinary web
and production extension configuration remains gated on production Clerk keys.

## Decision and boundary

The development Chrome SDK appends a browser JWT to URLs. This prototype instead
creates its own native client using documented FAPI endpoints, `_is_native=1`,
form bodies and the rotating Authorization response header. It never converts a
browser credential, imports Expo internals, impersonates a user or creates a user
session through privileged backend APIs. Native API access was already enabled on
the exact authorized OTPGuard development instance; no Clerk setting was changed.

Credentials remain in worker memory. The extension-owned login page clears the
credential input on submit and sends it only through internal runtime messaging.
Only that exact extension page may call the auth worker. There is no content script,
web-accessible resource, storage/cookie permission, external messaging or Gmail
permission. Network hosts and CSP are exact HTTPS origins. Requests omit cookies,
referrers and caches, reject redirects and time out after 15 seconds. FAPI decoded
responses are limited to 256 KiB. Errors do not retain provider causes or messages. Only an allowlist of documented provider error codes maps to fixed public labels; entered values and provider metadata are discarded.

Password or email-code sign-in, user-initiated email/password registration with email
verification, and TOTP/backup-code MFA are implemented. Missing registration requirements
(including legal consent) are never fabricated. Unavailable factors, OAuth redirects, client trust, CAPTCHA,
password reset and organization selection are unsupported and fail closed. There is
no automatic polling or resend. This is a REST experiment, not a claim that Clerk
supports a custom Chrome native SDK or that all account policies are implemented.

Before token acquisition and before/after a Convex operation, the worker refreshes
its native client selection and authoritative session status/user/expiry. Session
identity is valid locally for at most 30 seconds. Logout synchronously invalidates
authority, aborts in-flight FAPI work, waits for an outstanding bounded operation to
finish and ends its own selected session. Late replies cannot restore authority.
Cancel clears local authority; it does not promise remote session revocation.
Restart requires a fresh sign-in. Account replacement begins by clearing old local
authority; no dashboard cookie or cached client JWT is consulted.

The Convex probe accepts no arguments, writes no data and returns only the validated
identity's subject. Its client receives only a fresh `convex` template JWT. No Gmail,
email content or OTPGuard history is uploaded. Metadata sync is not activated.

The default Convex issuer policy still rejects development issuers. The explicit
`OTPGUARD_AUTH_PROFILE=native-development` profile accepts a development issuer only
on the existing `https://academic-grouse-256.convex.cloud` deployment, verified using
Convex's system `CONVEX_CLOUD_URL`. No production deployment or hosting was changed.
The development backend now contains the existing ownership-enforced schema/functions
and the read-only probe. The previously prepared JWT template has audience `convex`,
60-second lifetime and provider-reported 5-second allowed skew.

## Reproduce

Use Node 22.19.0 and Bun 1.4.2 with the locked dependencies. Supply only public
configuration; do not paste any JWT or secret key:

```sh
OTPGUARD_NATIVE_CLERK_ORIGIN=https://YOUR-INSTANCE.clerk.accounts.dev \
OTPGUARD_NATIVE_CONVEX_ORIGIN=https://academic-grouse-256.convex.cloud \
bun run build:native-auth
bun run test:native-browser
bun run test:native-browser --live
bun run test:native-browser --live --interactive
```

Alternatively load `build/native-auth-prototype` unpacked in Chrome and click its
action to open the login page. The output is separate from every production and mock
build. Existing provider files are not read or overwritten by this builder.

1. The initial **Create account** screen asks only for email and a new password.
   The current instance requires at least 15 characters and rejects breached passwords.
   Click the green **Create account** button. Email verification is sent as part of
   that explicit action, and the page advances to a code-only step.
2. Enter the received Clerk code directly in that browser and click **Verify**.
   Never put credentials or codes in chat or test artifacts. The authorized owner
   email had no existing account, established by a read-only lookup.
3. For a returning account, select **Sign in**, enter email and Continue. The page
   then offers password login or an explicit **Use an email code instead** action.
   Complete TOTP/backup-code MFA if Clerk requires it. Unsupported factors stop safely.
4. Once connected, **Check cloud connection** should report that the cloud identity
   is verified. This does not enable Gmail or autofill.
5. **Sign out** must confirm extension logout. Native identity is invalidated immediately;
   failed remote logout is not reported as success.
6. Failure check: **Start over** cancels a pending request, or end/revoke the extension
   session in Clerk. Subsequent authenticated operations must refuse it. Stop/restart
   the worker: no sign-in is recovered. Dashboard logout is deliberately independent.

The interactive browser runner uses a temporary profile, does not record traces,
screenshots, video, request bodies, response bodies or credentials, prints only fixed
acceptance states, and deletes that profile on normal exit. Its live URL audit checks
exact origins and that Clerk queries contain only `_is_native=1`. It does not inspect
or retain live passwords, OTPs or JWT values. Interrupted browser processes can require
manual cleanup of their temporary profile. Browser autocomplete is disabled on the
credential form; browser/device compromise is outside this prototype's guarantees.

## Validation and acceptance

| Acceptance                                                                                                                                                            | Result                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Native API enabled on exact OTPGuard development instance                                                                                                             | Achieved by read-only Platform API lookup                                                             |
| Real FAPI creates a native client and returns Authorization header without credential URL                                                                             | Achieved in Node and loaded Chromium                                                                  |
| Existing-account password/email-code, supported MFA, header rotation, fresh identity, revocation, selected-session change, cancellation, late result and logout logic | Achieved with 13 synthetic unit/backend tests                                                         |
| Loaded extension login/registration, credential-input clearing, Convex identity and logout                                                                            | Achieved with synthetic Chromium transport                                                            |
| Deployed Convex rejects anonymous callers                                                                                                                             | Achieved in live loaded Chromium                                                                      |
| Real owner login, template JWT exchange, authenticated Convex subject and provider logout                                                                             | Unverified; earlier owner attempts were refused, followed by a simplified staged UI and pending retry |
| Real dashboard login and cross-client independence                                                                                                                    | Unverified; standard dashboard development auth remains disabled                                      |
| Real Gmail retrieval and real-site autofill                                                                                                                           | Blocked by existing trusted SMTP receipt, sender and service-template gates                           |

Validation commands: `bun install --frozen-lockfile --offline`, `bun run build`,
`bun run check`, `bun run test:browser`, `bun run test:native-browser`, and
`bun run test:native-browser --live`. Results are recorded in the PR. Application
validation uses a fresh credential-free export because the owner's pre-existing
configured extension artifact is stale. Initial checks against that stale artifact
failed its size/manifest expectations; it was preserved, not treated as current code.

Final local results: 304 tests in 21 files, type/lint/format checks and both application
builds passed in `/tmp/otpguard-native-validation`. Browser results were 26 passes,
one configuration-dependent skip and three mock-pipeline timeouts before the required
`bun run build:mock`; the targeted pipeline rerun then passed all three (29 passes
combined, one skip). The final native browser run passed login, registration,
credential clearing, Convex identity and logout with synthetic transport. The live
Chromium native bootstrap and anonymous Convex rejection also passed. The owner
reported no existing Clerk account; native registration was then added and tested,
and updated owner browser acceptance was requested. The owner found the initial UI confusing; it was replaced by one-step-at-a-time registration/login and tested in Chromium. No successful owner registration,
JWT exchange or remote logout is inferred from that request.

The next review step is owner-controlled live sign-in acceptance and review of this
custom native experiment. Production integration, dashboard cloud transport, broader
auth factors and real Gmail work need separately selected scope. No real sender or
trusted receipt evidence was manufactured, and no unverified real fill was enabled.

## References

- [Clerk FAPI specification](https://raw.githubusercontent.com/clerk/openapi-specs/main/fapi/2021-02-05.yml): native header scheme, client/sign-in/session/touch/end/template-token endpoints.
- [Convex Clerk integration](https://docs.convex.dev/auth/clerk): issuer and `convex` audience validation.
- [Convex system environment variables](https://docs.convex.dev/production/environment-variables#system-environment-variables): deployment origin binding.
- [Earlier transport research](domain-free-auth-feasibility.md) and [Gmail receipt investigation](connected-gmail-feasibility.md) remain historical evidence; this owner-approved independent-session prototype supersedes their unapproved-account-model wording only.
