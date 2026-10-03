# OTPGuard — Codex PR Workflow

Status: repository workflow. Application implementation begins only when requested.

## 1. One reviewable PR at a time

Use one chat per implementation PR by default. Keep implementation, failed-check fixes,
and review revisions for that PR in the same chat. After approval and merge, the user
can open a new chat for the next PR. A chat is an organizational boundary, not a Git
branch or a substitute for repository documentation.

The user may continue in the existing chat if preferred; the one-PR scope and review
boundary still apply. Create a new chat only when explicitly asked. Never advance to
the next PR automatically, including after tests pass or the current PR is merged.

```text
User selects one PR
    ↓
Inspect repository and read its instructions
    ↓
Work on a separate branch for that PR
    ↓
Implement and validate
    ↓
Present results for review
    ↓
Fix review issues in the same chat
    ↓
User approves merge / authorizes publishing actions
    ↓
User starts the next PR, normally in a new chat
```

## 2. Where project context lives

Read [AGENTS.md](AGENTS.md), [HANDOFF.md](HANDOFF.md), and this workflow before
implementation. HANDOFF routes to the design and delivery references.

| File | Responsibility |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Repository entry-point instructions |
| [HANDOFF.md](HANDOFF.md) | Engineering context and reference index |
| [docs/design.md](docs/design.md) | Working product/security specification and feasibility gates |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Current PR sequence, scope, acceptance criteria, and completion report |
| CODEX_PR_WORKFLOW.md | Chat, branch, and review lifecycle |

The implementation plan is the single source for PR numbering. Use its current
16-PR sequence; this workflow does not introduce an alternative roadmap.

Inspect code, tests, and Git history to determine what actually exists. Claimed prior
completion in a prompt is context to verify, not proof. If implementation differs from
the design, investigate whether it is an intentional documented decision or drift;
do not silently make either one override the other.

As features arrive, add architecture documentation, the threat model, privacy notes,
and ADRs described in the plan. Update the affected documentation in the same PR as
the behavior change. These future documents are not assumed to exist already.
Files named `*.original.md` preserve historical proposals and do not govern implementation.

## 3. Branches and dependencies

Use a separate `codex/` branch for each implementation PR, for example:

```text
codex/project-foundation
codex/otp-detection
codex/autofill-engine
codex/otp-parser
codex/authorization-policy
```

Before creating or switching branches, inspect the current branch, worktree, uncommitted
changes, and configured remotes. Preserve existing work. Reuse the current PR branch
for its review fixes. Start subsequent sequential PRs from the actual updated integration
branch after their prerequisites are merged; do not assume its name is main.

Stacked PRs are an exception requiring the user's request. Document the base and
dependency explicitly if used. A Git branch does not isolate uncommitted files;
use a worktree when necessary to preserve work safely.

Use descriptive conventional PR titles from the implementation plan. Publishing a
branch, opening a remote PR, merging, and deploying follow the user's authorization.
Reviewing this workflow alone authorizes none of those actions. When no remote exists,
deliver a local reviewable change and proposed PR description. Never report a remote
PR or merge that did not happen.

## 4. Implementation and completion

Follow the implementation plan's per-PR workflow and review-report requirements.
Implement only the selected scope; add relevant tests and the minimal UI needed to
exercise it. Complete available checks and fix failures before presenting the result.

Report checks as passed, failed, skipped, or unverified, with exact commands and reasons.
Missing credentials or platform prerequisites are not passing results. Documentation-only
changes require content/link checks rather than irrelevant application builds.

Apply the design's privacy rules to live/personal OTPs, mail, and tokens. Synthetic
fixture codes are permitted for tests and controlled demo assets. Mock trust, synthetic
retrieval adapters, and development origin exceptions stay out of production bundles.
An unresolved security feasibility gate keeps dependent functionality disabled.

Present the acceptance criteria and completion report, then stop for review. A local
implementation can be ready for review while an external integration check remains
unverified; state that limitation explicitly rather than declaring full acceptance.

## 5. New-chat prompt template

Replace the bracketed values. Start the chat in this repository or its intended worktree.

```text
Read AGENTS.md, HANDOFF.md, and CODEX_PR_WORKFLOW.md.
Follow HANDOFF's design references and docs/implementation-plan.md.

Work ONLY on plan PR [NUMBER]: [NAME].

Goal:
[CONCRETE GOAL AND ANY USER-SPECIFIED SCOPE CHANGES]

Previous work reported complete:
[PR NUMBERS AND MERGE REFERENCES, OR "NONE"]

Inspect the actual checkout, Git history, and worktree before modifying files.
Verify which prerequisites exist, preserve uncommitted work, and use a codex/ branch.
Implement the selected scope with its relevant tests and documentation.
Validate using the plan's checks and report acceptance criteria and actual results.
Keep live OTPs, email content, and Gmail credentials local under the design's rules.
Keep synthetic fixture adapters out of production bundles.

Present the plan's completion report and stop for my review.
Do not start the next PR or create another chat automatically.

Publishing authorization for this request:
[LOCAL REVIEW ONLY, OR THE SPECIFIC REMOTE PR/PUBLISHING ACTION REQUESTED]
```

For PR 5, select **Pure authorization policy** from the current plan. Its scope includes
sender-evidence requirements, freshness, ambiguity, approved origins, and all four
security states. Domain equality by itself cannot produce VERIFIED. Gmail and extension
orchestration remain outside that PR.

## 6. Owner review checklist

Before approving a merge:

- Can I explain the resulting behavior and its limitations?
- Does the diff fit the selected PR and its acceptance criteria?
- Do tests cover important success, rejection, and failure behavior?
- Can I reproduce the manual test steps?
- Are new permissions, stored data, credentials, and data flows documented?
- Do live OTPs, personal mail, and Gmail tokens stay outside logs, persistent application
  storage, telemetry, and OTPGuard backend traffic?
- Are development fixtures excluded from production bundles?
- Are relevant checks passing, with skipped/unverified checks understood?
- Are architecture/security documentation and significant ADRs current?
- Is the change small enough to review and discuss confidently?

Approval of a PR's design or local results is distinct from authorization to merge
or deploy. Continue only with the action the user actually requests.
