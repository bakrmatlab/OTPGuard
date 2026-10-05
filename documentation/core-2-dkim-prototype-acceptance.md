# Core 2 follow-up: local DKIM prototype acceptance

October 4, 2026. Local review on `codex/core-2-real-mail-trust`, based on Core 1
`965bee562240a3178788d9cc1de8ba3bd3dc1bb2`; preserves the first feasibility report.
Proposed title: `feat(security): prototype local DKIM content authentication`.

The owner selected the local DKIM route. A development-only verifier now demonstrates
browser content authentication with a proposed narrower pilot contract in
[ADR0019](adr/0019-local-dkim-prototype.md). It does not enable real fill or change
production evidence types. This is Core 2 prerequisite work, not Core 3 completion.

## Acceptance

| Criterion                                                     | Result                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Browser raw-byte RSA-SHA256 verification                      | Passed synthetic Node/OpenSSL signatures in unit tests and actual Chromium           |
| Exact signer/sender/signed recipient and signed age policy    | Passed synthetic allow/refuse cases; no OpenAI mapping inferred                      |
| Tampered code/body/header, unsafe signature and key rejection | Passed synthetic regressions; full body required                                     |
| Canonicalization, leading zeros and non-ASCII body bytes      | Passed for supported subset; not general MIME/template acceptance                    |
| Bounded key lookup and sanitized output                       | Passed synthetic timeout/query/exception tests; no live resolver configured          |
| Direct receipt / replay exclusion                             | Explicitly not established; intact copied bytes authenticate again                   |
| Production exclusion / no access expansion                    | Isolated configured build passed; no new content entry, permission or installation   |
| Real OpenAI mail/template/challenge/events                    | Unverified; owner session preserved and no mail collected                            |
| Independent verifier audit / public DNS authenticity          | Unverified; new subset is experimental and not production-ready                      |
| Core 3 activation                                             | Disabled pending real-service evidence, narrower contract review and remaining gates |

## Validation commands

Use pinned Bun at `/tmp/otpguard-runtime/bun-darwin-aarch64/bun` for each command.

```sh
bun run test tests/dkim-prototype.test.ts tests/gmail-sender.test.ts tests/gmail-normalization.test.ts tests/security.test.ts
bun run typecheck
bun x eslint development/dkim tests/dkim-prototype.test.ts tests/fixtures/email/dkim.ts tests/browser/dkim-prototype.spec.ts
bun x playwright test --config development/dkim/playwright.config.ts
bun scripts/build-core-1.ts /tmp/otpguard-core-2-dkim-review-20261004
```

The isolated browser test uses intercepted synthetic HTTPS content and a temporary
Chromium profile, with trace/video/screenshots disabled. Initial sandbox launch failed
at macOS MachPort permission; an approved unsandboxed rerun passed. It did not touch
regular Chrome, Gmail, owner profiles or credentials. Results directory:
`/tmp/otpguard-core-2-dkim-browser-results` (synthetic only).

Controlled artifact:
`/tmp/otpguard-core-2-dkim-review-20261004/apps/extension/build/chrome-mv3-prod`.
This is a build/exclusion check, not a newly installed artifact or live acceptance.
The builder's Core 1 name describes existing configuration; no Core 1 acceptance
is counted as this prototype's acceptance.

Final verification passed: 350 tests in 24 files, including 44 new DKIM cases;
full workspace/tools/Convex typecheck; changed-code ESLint; one final Chromium test;
controlled extension build and artifact exclusion check. The configured manifest
matches the preserved Core 1 artifact exactly; no content scripts/optional site
permissions or prototype markers appear. Source inspection confirms no production
prototype imports and a zero-byte content entry. Current `bun audit --json` returned
`{}` (zero advisories) after an approved registry-access rerun; its initial sandbox
attempt failed DNS resolution. Formatting, relative-link and `git diff --check`
checks passed. The unit signing fixture uses Node/OpenSSL, while verification uses
Web Crypto; neither live mail nor a real service signature is acceptance evidence here.
No dependency/lockfile changes; the prototype imports only Web APIs. Broader website
builds/provider lifecycle tests are not required for this isolated code addition.

## Reproduce and review

1. Run the unit command: synthetic fixtures are generated with ephemeral RSA keys,
   fake addresses and a fabricated code. No private key or live bytes persist.
2. Run the isolated browser command. A valid copy returns only content authentication
   and explicit unresolved receipt/replay; changed bytes refuse.
3. Review the replay test: a second identical copy succeeds cryptographically. This
   demonstrates the product limitation and cannot be reported as replay protection.
4. Inspect production registry/evidence types and the isolated manifest/bundles.
   The experimental verifier must not be an extension entry or production import.
5. Before any real-service support, use the private original bytes and separately
   sanitized template provenance. Owner requests/enters the code directly. Do not
   paste it into chat, screenshots, logs or saved app data. No new DNS/provider access
   or fabricated direct-delivery flag is a shortcut to acceptance.

Stop for review. No merge, push, deployment, real retrieval or Core 3 activation.
