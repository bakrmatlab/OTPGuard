# Credential-free local release completion

Validation snapshot before the owner-authorized commit, merge and push.

October 3, 2026. Owner requested completion of problems that can be handled without
their help, extending the existing local build remediation. Branch remains
`codex/toolchain-package-remediation`, base `3e6334e`; changes are uncommitted.
Proposed title: `fix(build): make credential-free review packages reproducible`.

**Local build, dependency, packaging and review verification work is complete.**
Connected production deployment and public distribution remain blocked by the evidence
and decisions listed below. No live integration acceptance is inferred from local tests.

## Completed independently

- Removed the vulnerable Plasmo/Parcel dependency tree: current frozen audit reports
  zero advisories, compared with19 previously. CI now fails when its fresh audit fails.
- Replaced opaque extension asset copying with explicit Bun MV3 entries. Default artifact
  is2.56MB instead of312MB, with a25MiB regression budget and unchanged security gates.
- Added supported Next standalone output with a monorepo tracing root. The review ZIP
  carries required runtime files and static assets; no repository node_modules are needed
  after extraction. It is built for one OS/architecture, not a universal cross-platform ZIP.
- Added `bun run package:review` for default extension/web ZIPs and local provenance.
  Provider env files/variables, configured manifests, unexpected extension files, traced
  env/private-key material and dependency links outside the package cause refusal.
  Seven new actual CLI refusal tests cover these boundaries.
- Preserved traced internal dependency symlinks in web archives. A failing extracted-server
  test caught the original flattening mistake: Node could not resolve `@swc/helpers`.
  The corrected archive starts independently and passes browser checks.
- Added `bun run check:packages`: verify archive hashes and packaging platform, extract,
  run a private server on3201, check routes/sign-in/404/static assets/mobile/navigation,
  and load the extracted MV3 worker/popup in disposable Chromium. Cleanup is bounded,
  attempts all steps after failure, and only signals the child process it created.
- Wired audit, package creation and extracted-package smoke checks into existing Linux CI,
  without publishing artifacts or provisioning anything. Reconciled stale local planning
  status and public readiness statements.

## Reproduce

Use a clean clone/export containing current reviewed changes, Node22.19.0, Bun1.4.2,
`zip`/`unzip`, and available ports3100/3001/3201. Provider files/variables must be absent;
the owner's existing configured checkout intentionally cannot be packaged by this command.

```sh
bun install --frozen-lockfile
bun audit
NEXT_TELEMETRY_DISABLED=1 bun run build
bun run build:mock
bun run check
bun x --no-install playwright install chromium
bun run test:browser
bun run package:review
bun run check:packages
```

On Linux install Chromium with `--with-deps` instead. Outputs are ignored
`dist/review/extension.zip`, `web.zip`, and `provenance.json`. The default extension ZIP
has manifest at root. Web entry is `apps/web/server.js` inside its extracted tree; run
`HOSTNAME=127.0.0.1 PORT=3201 node apps/web/server.js` from that tree for local review.
Host selection, HTTPS/proxy/service management and publication are separate operations.

Provenance stores archive sizes/hashes, web build ID and **packaging context** (Git state
when available, Node/platform/architecture). It does not attest which commit produced
pre-existing artifacts, sign a release or prove a clean source build. Exported source has
null Git fields. Always build fresh on the target platform and run the smoke check;
native dependencies make a macOS package unsuitable for a Linux host. Archive hashes
prove consistency with that local record, not authenticity. Rebuilds need not be byte-identical.

## Validation and acceptance

Two isolated provider-free exports were used. One reused the cached frozen dependencies;
the other used a newly empty cache and actual public registry downloads. Browser executable
and Node/Bun were already installed; complete tool installation on a new machine is unverified.

| Check                                                                               | Outcome                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh `bun install --frozen-lockfile --cache-dir=/tmp/otpguard-empty-network-cache` | Passed294 platform installs from a new cache in3.06s; network package bootstrap now verified on macOS arm64                              |
| Fresh default web/extension builds and separate mock build                          | Passed                                                                                                                                   |
| `bun run check`                                                                     | Passed types, lint, format and291 tests/20files                                                                                          |
| `bun run check:convex`                                                              | Prior identical backend source:16 actual offline tests passed; included in full unit suite                                               |
| Full `bun run test:browser` from fresh dependencies                                 | 29passed/1configured-only skip; trace/video/failure capture off                                                                          |
| Earlier synthetic configured Gmail artifact                                         | 5manifest tests and3browser lifecycle cases passed with identity/fetch doubles; no live acceptance                                       |
| `bun audit --json` on final fresh tree                                              | Passed{} /exit0                                                                                                                          |
| `bun run package:review`                                                            | Passed default ZIPs, validated internal links and local provenance. Fresh archive sizes: extension829,890bytes; web12,844,097bytes       |
| `bun run check:packages`                                                            | Passed extracted standalone routes/mobile/assets/navigation and actual MV3 worker/popup, no external dashboard requests                  |
| Corrupt synthetic package cleanup probe                                             | Expected failure and owned-server cleanup verified before completion                                                                     |
| Public Markdown links/format and Git whitespace                                     | Verified before completion                                                                                                               |
| Standards/Spec review                                                               | Findings about shutdown cleanup and provenance attribution repaired; final Standards and Spec re-reviews reported no actionable findings |

Initial packaging refused a leftover synthetic `.env` file, as intended; that temporary
file was removed. The first archive failed startup because flattening dependency links
changed Node resolution. The corrected internally linked archive passes. A final check in the configured owner checkout passed types/lint/format but rejected its
preserved old configured extension in two artifact tests; the clean export is the accepted
validation target. Early lint
failures in the new smoke script were fixed; failed runs are not passing evidence.

The first standalone web build accidentally ran in the main checkout, rebuilding its
ignored web output. Subsequent builds/packages/tests used the isolated export. Provider
files, registered extension key and original extension build were not changed. The existing
server on3000 was not stopped/restarted by this work; it was initially listening and later
not reachable. Its exit cause is unverified. No personal profile/mailbox/provider settings
or live credentials were used. Test servers on3100/3001/3201 are separately owned and cleaned up.

## Remaining work that cannot be closed by these local changes

| Requirement                                   | Missing input/evidence or decision                                                                                                           | Current disposition                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Real sender and receipt trust                 | Controlled original mail/delivery evidence and a defensible receiving boundary; Gmail message fields alone do not establish it               | UNKNOWN sender/unverified receipt. If provenance cannot be established, owner must decide whether to revise the product/security design |
| Real service coverage                         | Two or three validated templates, exact senders/origins and sanitized provenance from authorized controlled flows                            | Empty registry; no service claim. Actual site/input compatibility cannot be validated against invented templates                        |
| Account authentication                        | Supported URL-free authoritative Clerk transport/instance and authorized HTTPS configuration, or an owner-selected architecture change       | Development keys still refused; worker no-cache/freshness/cancellation retained                                                         |
| Gmail lifecycle                               | Authorized controlled mailbox/registered client acceptance for consent/denial/expiry/switch/revoke and real network/CSP/storage behavior     | Connection code tested synthetically only; no live provider operation undertaken                                                        |
| Connected retrieval/fill/manual/retry/restart | Resolve trust/auth/coverage before implementing and accepting real browser-bound flows, including durable successful-message deduplication   | Disabled. Building an active path now would require inventing evidence or changing the security contract                                |
| Settings/device/dashboard cloud integration   | Authorized deployed issuer/audience/JWT configuration and minimal-claim transport acceptance, two-device tests                               | Inactive transport and unaccepted deployment; offline ownership evidence retained                                                       |
| Optional cloud history                        | Owner/provider policy eligibility/verification/assessment, consent and processor/scheduler/backup/deletion evidence                          | Client/server policy false; may remain deferred for an explicitly local-history product                                                 |
| Public hosting/store                          | Select operator/host/support/privacy contact, license/version/release policy and applicable Google/store reviews; authorization to publish   | Local packages only. No domain/resource purchase, hosting, store submission or deployment                                               |
| Platform/manual acceptance                    | Linux or hosted CI execution, actual Chrome toolbar/compatibility matrix, assistive-technology speech and final update/rollback verification | CI checks prepared; cannot claim results from an unexecuted runner or substitute automated DOM checks for human speech acceptance       |

Google's [message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages)
does not supply a dedicated trusted receiving-boundary attestation; sender/header claims
remain untrusted. The supported [Clerk client](https://clerk.com/docs/reference/chrome-extension/create-clerk-client)
and installed code have been reviewed; compatible live transport is not proven by CLI
login or hosting the demo. Next's [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
is runtime packaging, not a hosted deployment or proof of connected behavior.

No further local release fix is known from this review. This is not a claim that the full
product is finished or vulnerability-free. No commit, merge, push, remote PR, new chat,
provider activation/provisioning, paid resource or deployment was performed.
