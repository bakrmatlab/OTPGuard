# Packaging and distribution readiness

Status as of October 3, 2026: **local portfolio prototype; public distribution blocked**.
A buildable archive is not OAuth approval, store approval or a validated connected product.
No release version, license, store listing, public deployment or signed release is supplied.

## Reproducible local review package

Use the credential-free [setup](setup-demo.md) in a fresh clone. Build from current source;
a preserved local build can predate security repairs. Record the source commit and dirty
state alongside validation, without env contents, tokens or personal data.

```sh
NEXT_TELEMETRY_DISABLED=1 PLASMO_TELEMETRY_DISABLED=1 bun run build
bun run build:mock
bun run check
bun run test:browser
bun run check:convex
```

For production-extension local review, archive **only** the finalized
`apps/extension/build/chrome-mv3-prod` directory after inspecting its manifest and bundle.
On a machine with `zip`, run from repository root:

```sh
mkdir -p /tmp/otpguard-local-review
(cd apps/extension/build/chrome-mv3-prod && zip -qr /tmp/otpguard-local-review/otpguard-unconfigured.zip .)
unzip -l /tmp/otpguard-local-review/otpguard-unconfigured.zip
```

`manifest.json` must be at the archive root. Extract into a fresh temporary directory and
load it unpacked in a disposable profile. Confirm popup unavailable states and no site access,
injection, mail read, fill or submission. Default manifest: MV3, storage only, no OAuth/key/
hosts/content scripts/WAR/external messaging, self scripts, object none, connect none.
Keep the synthetic build separate; never include `development`, `.env*`, source maps containing
sensitive local material, provider files, test artifacts or personal data in a release package.
The archive here is a **local review artifact**, not approved for upload/distribution.

The PR16 default build measured 312,399,128 bytes unpacked and 59,173,611 bytes
compressed (75 ZIP entries), largely installed Clerk SDK chunks. Package size, unused
code and load/update cost need a separately reviewed SDK/bundling investigation before
distribution. Local load success is not a store-size or performance acceptance claim.

Configured Google builds must preserve the registered public key/client/ID and use matching
env for artifact checks. They add identity, restricted readonly OAuth, exact Gmail/revoke hosts
and minimum Chrome 116; they still have no site injection/fill. Configured synthetic browser
tests replace identity/fetch and are not live acceptance. Existing public config is intentionally
local; obtain your own separately authorized registration rather than borrowing the owner's.

Web packaging is `apps/web/.next` plus the matching application/runtime dependencies from
a normal Next build; local `start --port 3100` is verified, not a deployment procedure.
No portable standalone output or hosted integration has been accepted. Do not publish build
traces/configuration or claim production hosting readiness from a local dashboard build.

## Gates before a public release

| Gate                    | Actual status and required evidence                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real service coverage   | Zero validated templates/services; empty registry, sender UNKNOWN, receipt unverified. Need controlled direct-delivery and adversarial evidence, sanitized template provenance and exact approved origins                            |
| Real connected pipeline | Retrieval/fill/manual fill/retry/site permissions disabled; need fresh auth/mailbox/document binding, actual success/refusal, restart dedup, quotas/offline and input compatibility acceptance                                       |
| Gmail OAuth             | Historical owner reports registration/consent/install and popup reopen only; live revoke/switch/denial/network checks not independently verified. No restricted-scope verification approval established                              |
| Clerk account           | Development instance only; supported URL-free authoritative development transport not established; pk_test refused. Production/owned domain discussed but not authorized/activated; live session/logout/switch/CSP checks unverified |
| Convex                  | Development config exists locally, backend push failed missing issuer; no successful deployment or active client transport. Need reviewed JWT transport and live ownership/two-device/network/scheduler acceptance                   |
| Cloud activity          | Client/server policy false; derived-data eligibility, assessment, informed consent, retention/deletion/backups and processor controls unresolved                                                                                     |
| Dependencies            | Last PR15 audit failed 19 advisories (8 high/10 moderate/1 low). Hot reload disabled; coherent upgrade/removal and artifact/dev-origin regression validation required                                                                |
| Chrome Web Store        | No submission/review approval established. Need final permission purpose, accurate listing, reviewed hosted privacy policy and matching dashboard disclosures, support/deletion contact and release assets                           |
| Release operations      | Version/license decision, clean dependency review, compatibility matrix, artifact provenance, rollback/update plan and publication authorization still required; substantial automation separately scoped                            |

Google classifies `gmail.readonly` as restricted; local processing alone does not establish an
exemption. Review verification and assessment applicability for the actual final data flow.
Primary references: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification),
[Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy).
Google policy also covers derived data; a sanitized event is not automatically exempt.
Chrome's [user-data requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
require privacy disclosures to match actual behavior. This prototype privacy note needs
final operator/contact, hosting and data-flow review before use as a public policy.

Existing credential-free CI remains appropriate; it does not publish or certify integrations.
Hosted CI has not been triggered by this local work. Resolve each gate in separately authorized
work and revalidate the final artifact; do not remove gates to improve the portfolio demo.

## Local PR16 validation

On macOS arm64 with Node 22.19.0/Bun 1.4.2, current-source web/default-extension and
separate mock builds passed. Workspace types/lint/format and 283 tests across 19 files
passed; isolated Chromium passed 29 cases with one configured-only skip; 16 actual offline
Convex tests passed. The local ZIP was inspected, extracted and loaded in disposable
Chromium with unconfigured Gmail, disabled fill and no external popup requests. All five
screenshots were visually inspected; public relative links and asset paths were checked.
Fresh dependency audit **failed** with the same 19 advisories. No hosted CI, live provider,
assistive-technology speech, public deployment or store approval is inferred.

A clean temporary export without provider env files also passed a frozen offline install
and both production builds, mock build, 283 unit tests and 29 browser cases (one configured-only
skip) using cached dependencies. Network download/bootstrap on a new
machine and Linux execution were not independently performed in this local run.
