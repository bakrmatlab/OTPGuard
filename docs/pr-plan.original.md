Read `HANDOFF.md` completely before modifying the repository.

I do not want you to implement the entire OTPGuard project in one large change.

Instead, act like the primary engineer on a real software team and break the project into a sequence of small, reviewable pull requests.

## Main rule

Each PR should:

- Have one clear responsibility.
- Be independently understandable.
- Keep the application in a working state.
- Include relevant tests.
- Avoid unrelated refactors.
- Include a clear PR description.
- Include acceptance criteria.
- Document important architectural decisions.
- Be small enough that I can understand what changed before moving to the next PR.

Do not start implementing every feature at once.

---

# Proposed PR sequence

Use approximately this sequence unless inspecting the repository reveals a strong technical reason to adjust it.

## PR 1 — Project Foundation

Create the project architecture.

Include:

- Monorepo structure
- Plasmo browser extension
- React
- TypeScript strict mode
- Next.js application
- Shared packages
- Basic testing setup
- Linting/formatting
- Environment variable structure
- Basic README development instructions

Do not add Gmail integration yet.

Acceptance criteria:

- Extension builds.
- Next.js app builds.
- Tests run.
- Linting passes.
- Repository structure matches the intended architecture.

---

## PR 2 — OTP Field Detection

Implement OTP-field and verification-page detection.

Support:

- `autocomplete="one-time-code"`
- likely OTP field names
- common verification-page text
- single OTP fields
- split OTP fields

Create local test fixtures/pages.

Do not implement Gmail yet.

Acceptance criteria:

- Extension correctly recognizes supported test OTP pages.
- Normal unrelated numeric inputs are not incorrectly classified.
- Detection logic has tests.

---

## PR 3 — Autofill Engine

Implement the mechanism that fills OTP fields.

Support:

- single OTP input
- split OTP inputs
- framework-controlled inputs
- appropriate input/change events

Initially use a hardcoded development code.

Example:

```text
839192
```

Acceptance criteria:

- Hardcoded OTP fills correctly into test pages.
- Split fields work.
- React-controlled inputs recognize the new value.
- Tests cover the core behavior.

---

## PR 4 — OTP Parsing Engine

Implement OTP extraction independently from Gmail.

Use mock email fixtures.

The parser should:

- extract likely OTP candidates
- use surrounding context
- support common OTP lengths
- avoid choosing unrelated numeric values
- assign confidence scores

Test emails should contain misleading values such as:

- order numbers
- dates
- phone numbers
- prices
- tracking numbers

Acceptance criteria:

- Parser selects the actual verification code from test fixtures.
- Parser logic is modular.
- Comprehensive unit tests exist.

---

## PR 5 — Service Identification and Domain Validation

Implement the security layer.

Create reusable service definitions.

Initial services may include:

- GitHub
- Google
- Microsoft
- Discord
- Amazon

Implement:

```text
email
↓
identify issuing service
↓
determine expected domains
↓
compare against current website
↓
VERIFIED / UNKNOWN / MISMATCH
```

Use proper hostname/domain parsing.

Never use naive substring matching.

Examples that must fail:

```text
github-login.xyz
github.com.attacker.example
secure-github.example
```

Acceptance criteria:

- Valid domains pass.
- Phishing domains fail.
- Security logic has strong automated tests.

---

## PR 6 — Mock End-to-End Vertical Slice

Combine the components developed so far.

Demonstrate:

```text
OTP page detected
↓
mock verification email
↓
OTP extracted
↓
service identified
↓
domain validated
↓
OTP autofilled
```

Also demonstrate:

```text
GitHub OTP
+
fake GitHub domain
↓
AUTOFILL BLOCKED
```

This PR is an important milestone.

Do not begin real Gmail integration until this works reliably.

Acceptance criteria:

- Safe demo works end-to-end.
- Phishing demo blocks autofill.
- No backend or Gmail dependency is required for the demo.

---

## PR 7 — Clerk Authentication

Add Clerk authentication.

Integrate authentication with:

- browser extension
- Next.js web application

Keep OTPGuard authentication separate from Gmail authorization.

Acceptance criteria:

- User can authenticate from supported surfaces.
- Extension recognizes authenticated state.
- Web application recognizes the same user.

---

## PR 8 — Gmail OAuth

Implement Google OAuth specifically for Gmail access.

This is separate from Clerk login.

Request the minimum Gmail permissions necessary.

Acceptance criteria:

- User can connect Gmail.
- User can revoke/disconnect Gmail.
- OAuth errors are handled cleanly.
- No unnecessary Gmail permissions are requested.

---

## PR 9 — Gmail API Integration

Replace mock emails with real Gmail retrieval.

Implement:

- recent verification-email retrieval
- controlled polling/backoff when an OTP page is active
- stopping polling when a code is found or the flow expires
- integration with existing OTP parser

Do not continuously monitor Gmail when unnecessary.

Acceptance criteria:

- Real verification emails can enter the existing parsing pipeline.
- OTP processing remains local wherever practical.
- Gmail polling stops appropriately.
- No OTP values are logged.

---

## PR 10 — Convex

Add Convex for application state.

Store only appropriate metadata such as:

- settings
- devices
- trusted domains
- security events
- connected provider metadata

Never store OTP values.

Acceptance criteria:

- Metadata sync works.
- Security events can be recorded.
- Database schema contains no OTP field.
- Logs contain no OTP values.

---

## PR 11 — Extension UX

Build the production-quality extension UI.

Include:

- login state
- Gmail connection state
- protection status
- autofill enable/disable
- last security event
- blocked-autofill warning
- link to dashboard

Acceptance criteria:

- UI clearly communicates security state.
- Normal successful operation remains unobtrusive.

---

## PR 12 — Next.js Dashboard

Build the OTPGuard dashboard.

Initial pages:

- Overview
- Connected Accounts
- Security Activity
- Devices
- Trusted Domains
- Settings

Never display OTP values.

Acceptance criteria:

- Dashboard reads from authenticated Convex data.
- Security events are understandable.
- UI is polished enough for a portfolio demo.

---

## PR 13 — Security Hardening

Perform an explicit security pass.

Review:

- extension permissions
- Gmail permissions
- content-script exposure
- OTP lifetime
- logging
- Convex data
- OAuth token handling
- sender validation
- domain parsing
- malicious webpage scenarios
- stale OTPs
- multiple simultaneous OTPs

Update `docs/threat-model.md`.

Acceptance criteria:

- Known threats are documented.
- Mitigations are implemented or clearly documented.
- Sensitive values cannot accidentally enter logs or persistent storage.

---

## PR 14 — Production and Portfolio Polish

Add:

- CI
- GitHub Actions
- complete README
- architecture documentation
- privacy documentation
- threat model
- screenshots
- demo instructions
- development setup
- test instructions

README should clearly explain the project's differentiator:

OTPGuard does not blindly autofill email OTPs. It identifies the service issuing the code, validates the website requesting it, and blocks autofill when the domain relationship cannot be trusted.

---

# Workflow for every PR

Before implementing a PR:

1. Inspect the existing repository.
2. Read relevant sections of `HANDOFF.md`.
3. Determine exactly which files/components should change.
4. Avoid implementing future PR functionality.

Then implement the PR.

After implementation:

1. Run tests.
2. Run TypeScript checks.
3. Run linting.
4. Build affected applications.
5. Fix failures.
6. Review the diff for accidental scope expansion.

Then provide me with:

## PR Title

Use conventional descriptive naming.

Example:

`feat(extension): add OTP field detection`

## Summary

Explain what changed.

## Architecture Decisions

Explain important decisions and why they were made.

## Files Changed

Summarize the major files/components.

## Tests Added

Explain what is tested.

## Validation

Report:

- tests
- lint
- TypeScript
- build

## Manual Testing Instructions

Tell me exactly how I can test the feature myself.

## Security Considerations

Explain any security implications.

## Known Limitations

List anything intentionally deferred.

## Next PR

State what the logical next PR should implement.

---

# Important

Do not automatically begin the next PR after completing the current PR.

Finish the current PR completely and present its results for review.

The goal is for me to understand and review each stage of OTPGuard rather than receiving an entire AI-generated codebase at once.