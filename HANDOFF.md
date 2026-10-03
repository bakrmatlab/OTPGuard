# OTPGuard — Engineering Handoff

Read this file completely before modifying the repository.

## Build references

Before implementing a feature, read [docs/design.md](docs/design.md) completely on
first use, then revisit the sections affected by the change. It is the working product
and security specification; proposed defaults and feasibility gates remain labeled there.

Read [docs/implementation-plan.md](docs/implementation-plan.md) for the current PR's
scope, dependencies, acceptance criteria, and completion workflow.

For implementation and review revisions, read
[CODEX_PR_WORKFLOW.md](CODEX_PR_WORKFLOW.md) for chat, branch, and review lifecycle rules.

For the rationale behind changes to the original brief, consult
[docs/design-review.md](docs/design-review.md). Files named `*.original.md`
are historical inputs, not competing implementation specifications.

## Review boundary

Implement one requested PR at a time. Complete its validation and present its results,
then stop for user review. Begin the next PR only when the user asks to proceed.
The current planning work authorizes documentation changes, not PR 1 implementation.

Use a separate `codex/` branch per implementation PR. Inspect the checkout and preserve
existing work before creating or switching branches. Publishing, merging, and deployment
follow the user's authorization; a local reviewable change is sufficient when no GitHub
remote or publishing instruction exists. Never claim a PR was opened unless it was.

## Change discipline

Keep the application usable at the current milestone: incomplete capabilities are
disabled or explicitly marked unsupported. Keep synthetic fixture adapters and test
origin exceptions out of production bundles. Production code releases OTPs only through
the authorization boundary specified in the design.

When implementation evidence requires changing the plan, document the concrete finding
and adjust the affected scope before proceeding. Preserve the design's security and
privacy invariants; unresolved feasibility gates keep dependent features disabled.

Record significant decisions in `docs/adr/` as they are made. Each record states the
problem, chosen approach, relevant alternatives, consequences, and verification evidence.
Routine function or file-layout choices do not require an ADR.
