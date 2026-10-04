# Core 1: Authenticated Gmail connection

October 4, 2026. Proposed title: `feat(gmail): connect the authenticated extension to a real mailbox`.
Branch `codex/core-1-gmail-connection`, base `4925c19`. Owner approved merge and
push on October 4 after reviewing the partial acceptance results below. This approval
does not authorize website/backend deployment or public submission.

## Result

One combined controlled extension is installed in regular Chrome under the stable ID
`jfncecbkgdnhdppgpblbokkceflpmgif`. The existing Google-authenticated Clerk session
is recognized, fresh production Convex identity passes, and explicit Connect Gmail
shows the owner-confirmed intended mailbox separately from the OTPGuard identity.
Real retrieval, sender trust, site injection/fill and cloud activity remain disabled.

The worker now binds Connect/Check to fresh Clerk authorization and rechecks after
Google operations. Session replacement requires disconnect before inheriting the
mailbox. Account invalidation cancels pending Gmail work. Independent account/mailbox
emails remain supported; mismatching Gmail profile against an already bound mailbox
refuses. Disconnect remains available without Clerk. Restart requires explicit Connect.
See [ADR0017](adr/0017-authenticated-gmail-connection.md).

## Provider and distribution evidence

- Installed authenticated gcloud was inspected first, using its prepared config directory.
  Clerk's installed CLI and the existing provider scripts were inspected; the new artifact
  needs no Clerk provider change. Google documents Chrome-extension client registration
  through Console. SDK IAM OAuth clients are workforce federation clients and were not used.
  Native Chrome UI was used for unsupported client setup and loading an unpacked extension
  into the existing owner profile; no supported API/CLI for that running-profile action was available.
- Console confirmed old client `258500494856-r94trpdsakss2m8pm0h0c4paeidlksqd.apps.googleusercontent.com`
  has Item ID `gifhbgecaldcelehjbdajpmigniehlpi`. It was not edited/deleted or revoked.
- Owner approved the exact prepared client creation. Created Chrome-extension client
  **OTPGuard Core 1 controlled extension**, ID
  `258500494856-veuqutd3v0ib5hohg08sh5utshb70o80.apps.googleusercontent.com`, for the
  stable auth ID. Console creation succeeded and list readback showed new, old and
  social-login clients. The social web client was not modified. No secret was downloaded.
- Google project `otpguard-20261003` remains **External / Testing**, with one owner test
  user observed. No audience publication, user addition or scope-verification change.
- Owner approved loading the combined artifact, with identity and Google endpoint access.
  Chrome confirmed the exact ID, enabled state and updated description; old extension
  remains enabled and unchanged. Previous auth-only artifact remains at
  `/tmp/otpguard-domain-validation/apps/extension/build/chrome-mv3-prod`.
- Explicit Connect returned a connected mailbox immediately, **without a new Google consent
  screen**. Google reused existing project authorization. The owner confirmed the displayed
  mailbox is intended. This does not count as fresh readonly-consent-screen acceptance,
  a newly isolated grant, or a test of denial. No tokens were copied between artifacts.
- Scope/distribution clarification was started early. Controlled owner pilot is the working
  assumption; wider tester/public distribution was not authorized by an answer. The only
  requested Gmail scope is `gmail.readonly`: broad mailbox reading, not an OTP-only boundary.
  Core 1 uses profile only; this scope serves the planned later local body retrieval.
  Restricted-scope verification and applicable assessment remain separate provider gates;
  local processing does not establish exemption. Cloud history stays off.
- Google revocation invalidates scopes/tokens for all clients in the project for this account.
  Therefore live disconnect/revoke was **not performed**, preserving the old grant. The popup
  now discloses this and requires confirmation. A separate project would be needed for
  independently revocable grants; no such migration/setup is authorized here.

Primary references checked October 4:
[client management](https://support.google.com/cloud/answer/15549257),
[Chrome OAuth](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth),
[Gmail scope classification](https://developers.google.com/workspace/gmail/api/auth/scopes),
[restricted-scope review](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification),
[project-wide revocation](https://developers.google.com/identity/protocols/oauth2/native-app).

## Acceptance

| Criterion                                                          | Synthetic/source evidence                                             | Actual provider evidence                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Correct combined ID and shared Google-authenticated account        | Stable key/ID build guard; manifest checks                            | Passed, installed exact ID and account shown                              |
| Fresh production Convex identity                                   | Existing binding/subject regressions                                  | Passed on combined and reviewed artifacts                                 |
| Explicit Connect and intended mailbox, separate identities         | Worker readonly scope/profile boundary                                | Passed; owner confirmed mailbox                                           |
| Fresh Google readonly consent screen                               | Request scopes checked                                                | Unverified: prior authorization reused, no new screen                     |
| Denial and missing scope refuse/retry safely                       | Existing lifecycle tests passed                                       | Unverified live                                                           |
| Grant revoke, noninteractive refresh refusal, cache/revoke failure | Lifecycle/worker tests passed                                         | Unverified live; revoke would affect preserved old grant                  |
| Gmail mailbox replacement refuses                                  | Lifecycle/controller tests; popup states                              | Unverified live account switch                                            |
| Clerk logout/switch/expiry during consent refuses                  | Fresh binding and delayed-grant regression                            | Broader live lifecycle unverified; previous Google login report separate  |
| Worker restart requires explicit Connect                           | Fresh-controller regression; no startup token call                    | Passed via actual extension reload: disconnected, then explicit reconnect |
| Disconnect explains project-wide effect; cancellation leaves state | Synthetic popup confirmation/cancellation passed                      | Warning visible; no live revocation performed                             |
| No token app persistence/backend/content delivery                  | Worker header/body-only tests, exact messages, no-cache Clerk adapter | Full live network/storage/callback audit unverified                       |
| No message retrieval/site injection/fill/cloud activation          | Final artifact/manifest checked                                       | Disabled controls visible; no real OTP journey claimed                    |

Live environment: regular Google Chrome **154.0.8037.93**, macOS **27.0.1**.
Owner entered no credential or consent into chat. This report retains only sanitized
states/equality outcomes, not account identifiers, mailbox addresses or token values.
The owner Google session and the reviewed extension were left signed in/connected.
A worker may subsequently terminate and require Connect again, by design.

## Validation

Pinned Bun: `/tmp/otpguard-runtime/bun-darwin-aarch64/bun` (1.4.2).
Source validation copy: `/tmp/otpguard-core-1-validation`; env files excluded.
Dependencies copied for isolated Next/Turbopack resolution; no provider secrets needed.

| Command/check                                                                        | Result                                                                                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                                                  | Passed across workspaces, tools and Convex                                                            |
| `bun run lint`                                                                       | Passed                                                                                                |
| `bun run format:check`                                                               | Passed; final report formatting checked separately                                                    |
| `bun run build` in isolated validation copy                                          | Passed extension and Next production builds                                                           |
| `bun run test` in isolated validation copy                                           | 23 files, 306 tests passed                                                                            |
| `bun run check:convex`                                                               | Passed type check and 16 backend tests                                                                |
| `PATH=/tmp/otpguard-runtime/bun-darwin-aarch64:$PATH bun run test:browser`           | Initial run: 26 passed, 1 configured-Gmail skip, 3 pipeline failures due missing development artifact |
| `bun run build:mock`, then `bun x playwright test tests/browser/pipeline.spec.ts`    | All 3 failed cases passed on prerequisite-corrected rerun                                             |
| `bun run-core-1-browser.cjs` in isolated validation copy (final configured artifact) | 3 passed, including disconnect-confirmation cancellation; no live OAuth                               |
| `bun audit`                                                                          | Network retry passed: zero advisories, 366 packages checked                                           |
| Final manifest/bundle inspection                                                     | Passed: no content scripts/site permissions/fixtures/message retrieval URL/Clerk secret key           |
| Existing-output refusal in `build-core-1.ts`                                         | Expected failure; artifact SHA-256 values unchanged                                                   |
| `git diff --check`                                                                   | Passed                                                                                                |

The configured browser test uses `OTPGUARD_TEST_EXTENSION` pointing at the reviewed
artifact and the three public Gmail configuration variables. A temporary Playwright
config selects only `gmail.spec.ts` without fixture servers; its popup responses are
synthetic and the synthetic state test asserts no external request occurs. The actual
worker token transport is covered by separate unit tests, not those popup mocks.

Retained initial failures: the first gcloud invocation omitted its prepared config and
was refused by filesystem restrictions; the prepared-config retry succeeded. The first
isolated Turbopack build rejected dependency symlinks outside its root, then reported
missing package-local dependency links; copied dependency trees fixed both. Two existing
worker tests needed the newly imported accountGate mock; both passed after that update.
Sandbox Chromium/server launch and audit DNS failed; permitted execution retries passed.
The wider browser pipeline initially lacked its deliberately excluded mock build;
only the failed cases were rerun after the required development artifact was built.
No runtime authorization workaround was introduced. One actual Connect refusal later recurred
while the Clerk label remained signed in. The diagnosing-bugs loop reproduced the same
`SIGN_IN_REQUIRED` symptom deterministically with stable synthetic identity: a newer
status refresh superseded Connect's in-flight read. `bun x vitest run
tests/gmail-authenticated.test.ts` was red before repair and green afterward. Popup
checks, Connect/Check/Disconnect and identity probes now share a serial request queue;
periodic polls skip active work. Sign-out remains immediate and cancels authority.
The strict worker gate is unchanged; separate simultaneous popups can still safely
refuse competing reads. Actual provider outage/switch/expiry is not masked by a retry. The repaired final artifact
was loaded and explicit live Connect succeeded; fresh Convex identity was rechecked.

**Preservation exception:** one broad build was mistakenly started in the checkout
before isolated validation. It regenerated ignored checkout extension/web build outputs.
This was reported immediately. It did not write env files, alter the old client/grant,
modify Chrome profiles outside the approved load, or overwrite the separate owner-tested
`/tmp` artifacts. Preservation of the checkout's prior generated bytes cannot be claimed.
All subsequent configured artifacts were built into new exports.

## Artifact and reproducible steps

Installed reviewed artifact:
`/tmp/otpguard-core-1-connection-review/apps/extension/build/chrome-mv3-prod`.
Source and public build record are in that export. It is a controlled unpacked pilot,
version 0.0.0, not a Chrome Web Store/public-release package.

Rebuild into a **new** absolute directory, never an existing owner export:

```sh
/tmp/otpguard-runtime/bun-darwin-aarch64/bun scripts/build-core-1.ts /tmp/otpguard-core-1-new-review
```

The builder uses only checked-in public auth/Gmail config, excludes owner env/build
files and clears inherited provider configuration from its build environment. It does
not read/copy the private Clerk keys or downloaded social credentials. Output directories
are refused if they exist. The current checkout's installed dependencies are reused.

Reviewed hashes:

| File           | SHA-256                                                            |
| -------------- | ------------------------------------------------------------------ |
| background.js  | `8b6cff857ad806e804e0b4d653716078d5ea5de22d1635052866196038ddfa10` |
| popup-entry.js | `73cf62cb6c44f5398a64c082d6ee9ad69c1bbf1a30a82180ff340b5ffa4fb051` |
| manifest.json  | `0c12eef8adee02aa7c8bd82022a3cc54379c8a9a9307d02f5097ad07cdda7839` |

Permissions: `storage`, `cookies`, `identity`; exact Clerk, Gmail API, revocation and
production Convex hosts. OAuth requests readonly only. Minimum Chrome 116. No content
scripts, site access, externally-connectable interface or web-accessible token path.

1. In regular Chrome Extensions, identify by **ID**, not name. Load the reviewed directory
   for `jfncecbkgdnhdppgpblbokkceflpmgif`; preserve the old `gifhb…` installation.
2. Sign in with Google on `https://otpguard.net/sign-in` directly. Open the correct
   extension popup and allow the authoritative account check to finish.
3. Use **Check cloud identity**; expect verified for that check, not a sync claim.
4. Use **Connect Gmail** explicitly. Owner completes any Google login/consent directly.
   A prior project grant may skip consent. Verify **Mailbox** independently of Clerk.
5. **Check Gmail connection** is noninteractive. A failed/scope/identity state must not
   imply connection or request surprise consent; explicit retry remains available.
6. Reload that extension: mailbox must begin disconnected, while Clerk can remain signed
   in. Only explicit Connect restores it. Actual Core 1 reload/reconnect passed.
7. **Disconnect Gmail** warns about project-wide revocation. Cancel preserves local
   state. Only approve if invalidating old-project grants is intended; do not perform
   this live check while preserving the owner's old grant. On approved failure, expect
   local disconnection plus revocation/cache-unconfirmed status, not false success.

Remaining acceptance: fresh consent/denial/partial scope, actual grant revoke and
failure/offline paths, live Gmail/Clerk switching, natural expiry, full live credential
URL/network/storage audit, natural worker termination and keyboard/screen-reader behavior.
Source/synthetic guarantees do not establish all those provider behaviors.

Core 2 is the next logical scope (one real service and defensible receipt/sender evidence).
It has not been started. Core 1 is approved for merge with these explicit live limits.
