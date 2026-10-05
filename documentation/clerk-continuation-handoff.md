# Generic filling continuation — October 5, 2026

Owner requested committing, merging and pushing the current implementation, then
continuing the unresolved Clerk issue in a new chat. Read AGENTS.md, HANDOFF.md,
CODEX_PR_WORKFLOW.md and the selected generic scope in docs/implementation-plan.md.

## Task and owner constraints

Fix general email-code matching/detection/retrieval so Clerk and unfamiliar sites
work without per-site configuration. Canva works in owner testing; Clerk still
fails. Do not use live browser/UI/real mailbox testing: the owner explicitly says
leave all live testing to them. Use code inspection and synthetic regressions only.
No Canva- or Clerk-only exception. Preserve minimal Code found / Fill; no sender or
destination beside Fill. User-confirmed generic mode never asserts VERIFIED sender
trust. Never transmit live mail, codes or OAuth tokens to logs/storage/backend.

One local fix scope at a time on a new codex/ branch from actual updated main.
This follow-up is authorized implementation, not automatic publishing/merging or
provider changes. Do not create another chat or start unrelated features.

## Current implementation

Generic coordinator uses registry=[] and user-confirmed mode. Worker detection
permission is optional https://_/_; historical Canva policy in packages/security
is a separate strict pilot, not a generic admission requirement. Gmail listing is
time-only, no sender allowlist. Receipt window, recipient hints, English numeric
4–8 code parser, field lengths, multiple-code/parallel-request ambiguity and binding
checks can still exclude codes. Raw MIME supports mixed/related/alternative, QP,
base64, standard fatal TextDecoder charsets, HTML entities and decorative digits.

Important files: packages/otp/{generic,raw}.ts, packages/security/generic.ts,
apps/extension/{content,detection/index,insertion/index}.ts,
apps/extension/gmail/{retrieval,transport,connected}.ts,
apps/extension/pipeline/{coordinator,worker,protocol,progress}.ts and popup.tsx.
See ADR0022/0023 and generic-reliability-acceptance.md for limitations and evidence.

## Live observations, not synthetic proof

Canva fills. Clerk challenge at https://dashboard.clerk.com/sign-in/factor-one
is visually six slots but likely one native input under decorative slots. Synthetic
nested control tests pass. Owner reports email arrived but search stays SEARCHING.
Past diagnostic showed recipient exclusion; that event may describe another recent
message, not necessarily Clerk mail. User never provided actual expanded stage trail.
Latest screenshot showed SEARCHING and 2 seconds, Request progress collapsed.
No actual Clerk message was inspected/stored; do not assert its MIME/template known.

Reproduced and fixed separate bugs: Chrome SPA sender URL drift under same document;
synchronous Extension context invalidated throw; stale deadline status when timer
is delayed; prior-page display; completed timer; diagnostic freeze at zero during
new admission when status still contained previous FILLED. The last one was our
own regression. These fixes are not confirmation of Clerk code selection success.
Owner asked for a new approach and check for accidental site restriction. Avoid
another speculative diagnostic-only patch presented as a Clerk fix. Build an exact
synthetic failure loop at the admission/retrieval/filter seam before modifying it.

Progress is volatile closed stages and last-12 trail, no mail data. Status polling
is read-only except deadline enforcement; terminal callbacks freeze clocks. New
admission reports SEARCHING while account/mailbox/page checks await. Tab/nav events
hide old display; main search text stable, details show per-email stages.

## Validation/runtime

Pinned Bun 1.4.2: /tmp/otpguard-runtime/bun-darwin-aarch64/bun.
Root node_modules lacks entities/decode; exported validation checkout has the
locked dependencies at /tmp/otpguard-generic-validation. Do not misreport root
missing dependency as product failure. /tmp/otpguard-export.py exports tracked and
selected untracked sources; explicitly copy new progress.ts when exporting before
commit (after commit tracked export includes it). Synthetic tests do not use owner UI.

Latest reviewed configured build:
/tmp/otpguard-progress-clock-review/apps/extension/build/chrome-mv3-prod.
Stable extension ID jfncecbkgdnhdppgpblbokkceflpmgif; existing public configuration,
no grant/installation changes. Artifact JSON records source/bundle hashes; temp
paths are local review artifacts, not deployed/reproducible external binaries.
Build-helper scripts under /tmp are local only. Final validation and publication
results are appended to generic-reliability-acceptance.md by the sending chat.

## Continuation approach

Inspect evidence and actual call chain, including background message routing,
request admission/current checks, Gmail query time floor, raw recipient extraction,
parse rejection and coordinator selection. Do not assume SEARCHING proves Gmail
was entered (admission also reports SEARCHING). Add integration regressions that
connect the real production seams across a completed Canva request and a new,
unconfigured-site/Clerk-shaped request, including pending account checks and field
replacement. Preserve click-before-release, replay and stale-request checks.
Report remaining unknowns clearly; any required live experiment belongs to the owner.
