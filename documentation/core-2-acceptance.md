# Core 2 acceptance: mail trust feasibility

October 4, 2026. Local review only on `codex/core-2-real-mail-trust`, based on
`965bee562240a3178788d9cc1de8ba3bd3dc1bb2`. Documentation-only feasibility deliverable;
no claim of a working real email-code flow, new build or remote PR.

Proposed title: `docs(security): record Core 2 mail trust feasibility gate`.

The reviewed public Gmail contract does not justify the current direct-receipt
boundary. Real fill remains disabled. [ADR0018](adr/0018-core-2-mail-trust-feasibility.md)
records the decision and concrete owner-selectable alternatives. Supporting evidence:
[sender research](core-2-sender-research.md), [boundary verification](core-2-boundary-verification.md),
[OpenAI candidate dossier](core-2-service-candidate.md). No service is registered.

## Acceptance results

| Criterion                                                              | Result                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Concrete evidence finding and product/architecture alternatives        | Achieved as Core 2's permitted feasibility output; proposed for review               |
| Genuine owner-controlled service challenge                             | Unverified: regular Chrome shows signed-in ChatGPT homepage; no logout performed     |
| Exact real template/extraction and sanitized real fixture              | Unverified: no requested mail inspected; no synthetic fixture mislabeled real        |
| Justified sender/direct receipt against forge, forward, import, replay | Unresolved: public contract insufficient; no live adversarial experiment             |
| Exact supported destination, field/events, freshness/signing mapping   | Unverified; candidate guidance does not supply these acceptance facts                |
| Unknown/forged/ambiguous/stale refusal mechanics                       | Passed existing synthetic tests; not live service acceptance                         |
| Real automatic/manual release disabled                                 | Preserved in source; empty registry and UNKNOWN adapter; no new artifact installed   |
| Privacy and provider access                                            | No live mail/code/token collected; no scope, endpoint, grant, env or storage changes |

## Validation

Passed:

```sh
/tmp/otpguard-runtime/bun-darwin-aarch64/bun run test tests/gmail-sender.test.ts tests/gmail-normalization.test.ts tests/security.test.ts
```

Three files, 108 tests. The tests cover forged/duplicate/reordered result headers,
spoofed From, synthetic ARC claims, copied fresh import representations, bounded
MIME rejection and policy freshness/ambiguity. This rerun is not Core 1's 306-test
acceptance and does not prove live DKIM or ARC verification.

Documentation checks passed: pinned Bun `x prettier --check` on all changed
tracked Markdown, `git diff --check`, and a Python check resolving all relative
links in the six deliverable files. ADR0018 is in `documentation/adr/` for the
reviewable diff; a local copy follows HANDOFF's `docs/adr/` convention (that tree
is gitignored). Application builds/typecheck/audit/browser fill are skipped because
runtime/config/dependencies are unchanged. No owner outputs are overwritten.

## Reproduce the review

1. Confirm the branch/base and inspect the documentation-only diff plus new files.
2. Read the primary sources linked in the research and ADR, including insert/import
   and receipt timestamps. Compare the missing contract to design sections 5 and 7.
3. Inspect `packages/security/gmail.ts` and `packages/security/index.ts`: UNKNOWN,
   unverified receipt and empty registry still prevent real service authorization.
4. Run the three synthetic suites above. In particular, copied receiver-looking
   claims and fresh timestamps must not elevate sender trust.
5. Review one alternative in ADR0018 before authorizing any new implementation.
   For a future real test, owner requests/enters codes directly; inspect original
   bytes privately, retain sanitized outcomes only, and distinguish template tests
   from cryptographic evidence. Do not broaden provider access to run an import test.

Stop for owner review. Core 3 is the planned dependent stage but must not activate
without resolution or explicit revision of the evidence contract. No merge, push,
deployment, provider configuration or broader lifecycle work was performed.
