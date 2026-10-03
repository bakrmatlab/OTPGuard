# OTPGuard — Project Handoff

## 1. Project Summary

Build **OTPGuard**, a privacy-first browser extension that automatically retrieves email verification codes, determines whether the code belongs to the website currently requesting it, and securely autofills the OTP.

The core user experience should be:

1. User attempts to sign in to a website.
2. Website asks the user to enter a verification code sent by email.
3. OTPGuard detects that the page is requesting an OTP.
4. OTPGuard checks the user's connected Gmail account.
5. OTPGuard finds the relevant recent verification email.
6. OTPGuard extracts the verification code.
7. OTPGuard determines which service issued the code.
8. OTPGuard compares that service with the current website/domain.
9. If the domain is trusted/matches:
   - Autofill the OTP.
10. If the domain looks suspicious or does not match:
   - Do not expose or autofill the OTP.
   - Warn the user.

Example:

```text
Current site:
github.com

Latest email:
"Your GitHub verification code is 839192"

OTPGuard determines:
GitHub → github.com

MATCH

→ Autofill 839192
```

Example phishing case:

```text
Current site:
github-secure-login.xyz

Latest email:
"Your GitHub verification code is 839192"

Expected domain:
github.com

DOMAIN MISMATCH

→ Do NOT autofill
→ Show warning
```

---

# 2. Main Goal

The main goal is not merely:

> Read a Gmail code and paste it.

The project should demonstrate:

- Browser extension development
- Full-stack TypeScript
- OAuth integration
- Gmail API integration
- Authentication
- Secure handling of sensitive information
- Domain/service verification
- Phishing protection
- Local-first processing
- Threat modeling
- Clean software architecture
- Testing
- CI/CD

This is being built as a serious **Computer Science / Cybersecurity portfolio project**.

Code quality, architecture, security decisions, documentation, and maintainability matter.

---

# 3. Technology Stack

Use the following stack unless there is a strong technical reason not to.

## Browser Extension

- TypeScript
- React
- Plasmo
- Chrome Manifest V3
- Chrome Extension APIs

The extension should eventually be architected so Firefox support can be added later.

---

## Web Application

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

The website will eventually serve:

```text
otpguard.dev
```

The exact production domain may change.

---

## Authentication

Use:

- Clerk

Clerk should provide authentication for:

- Web dashboard
- Browser extension
- User identity
- Device/session association

Do not confuse Clerk Google authentication with Gmail authorization.

They are separate systems.

---

# 4. Important Authentication Distinction

There are two different authorization systems.

## OTPGuard Account Authentication

Handled by Clerk.

Purpose:

```text
Who is using OTPGuard?
```

Example:

```text
User signs into OTPGuard with Google through Clerk.
```

---

## Gmail Authorization

Handled separately through Google OAuth.

Purpose:

```text
Does this user authorize OTPGuard to access the Gmail data required to detect OTP emails?
```

Do not assume signing into Clerk through Google automatically provides Gmail API access.

The Gmail OAuth connection must be implemented separately.

---

# 5. Backend / Database

Use:

- Convex

Convex should store application data such as:

```text
users
devices
settings
trustedDomains
blockedDomains
connectedProviders
securityEvents
```

Example conceptual schema:

```text
users
 └── clerkUserId

devices
 ├── userId
 ├── browser
 ├── deviceName
 ├── lastSeen
 └── createdAt

settings
 ├── userId
 ├── autoFill
 ├── autoSubmit
 ├── phishingProtection
 └── notifications

trustedDomains
 ├── userId
 ├── domain
 ├── service
 └── createdAt

securityEvents
 ├── userId
 ├── service
 ├── domain
 ├── action
 ├── reason
 └── timestamp
```

The final schema may differ if a better normalized structure is appropriate.

---

# 6. Critical Privacy Requirement

## Never permanently store OTP codes.

OTP codes should NOT be stored inside Convex.

Do not create records like:

```json
{
  "otp": "839192"
}
```

OTP values should ideally follow this lifecycle:

```text
Gmail
  ↓
Extension retrieves email
  ↓
OTP extracted locally
  ↓
OTP temporarily kept in memory
  ↓
OTP inserted into webpage
  ↓
OTP discarded
```

Avoid:

```text
Gmail
  ↓
Backend
  ↓
Database
  ↓
Extension
```

unless there is a compelling architectural reason and the security model has been reconsidered.

The preferred architecture is local-first.

---

# 7. Extension Architecture

The extension should roughly consist of:

```text
Extension
│
├── Background Service Worker
│   ├── Authentication coordination
│   ├── Gmail integration
│   ├── OTP retrieval
│   ├── OTP extraction
│   ├── Service detection
│   └── Security validation
│
├── Content Script
│   ├── Detect OTP pages
│   ├── Detect OTP inputs
│   ├── Send page/domain context
│   ├── Receive approved OTP
│   └── Fill input
│
├── Popup
│   ├── Login state
│   ├── Gmail connection state
│   ├── Last action
│   ├── Enable/disable autofill
│   └── Security status
│
└── Shared
    ├── Types
    ├── Domain utilities
    ├── OTP parsing
    ├── Service matching
    └── Security logic
```

Keep business logic outside React components whenever possible.

---

# 8. OTP Page Detection

The extension must identify when a page is likely requesting an OTP.

Do not rely solely on one selector.

Potential signals include:

```html
autocomplete="one-time-code"
```

Input names such as:

```text
otp
code
verification-code
verificationCode
two-factor-code
2fa
token
```

Associated page text may include:

```text
Verification code
Enter code
Security code
Check your email
We've sent you a code
One-time code
Confirm your identity
Verify your email
```

Use multiple signals and assign confidence rather than assuming every numeric input is an OTP field.

Avoid interacting with unrelated numeric fields.

---

# 9. Supported OTP Input Styles

Support at minimum:

## Single input

```text
[ 839192 ]
```

## Split inputs

```text
[8] [3] [9] [1] [9] [2]
```

The autofill logic needs to support both.

When filling fields, correctly trigger browser/framework events so applications built with React, Vue, Angular, etc. recognize the input.

Do not assume:

```ts
input.value = code
```

alone will always work.

Trigger appropriate events.

---

# 10. Gmail Retrieval

For MVP:

- Support Gmail only.
- Outlook support comes later.

When an OTP field is detected:

```text
OTP page detected
      ↓
Request recent Gmail verification emails
      ↓
Analyze candidate messages
      ↓
Find likely matching service
      ↓
Extract OTP
```

Do not continuously poll Gmail every few seconds all day.

Chrome Manifest V3 background service workers may be suspended.

Use context-aware retrieval.

Example:

```text
User opens OTP page
        ↓
Check Gmail immediately
        ↓
No matching email?
        ↓
Retry using controlled backoff
        ↓
Code found
        ↓
Stop checking
```

Possible retry sequence:

```text
Immediate
2 seconds
4 seconds
6 seconds
10 seconds
```

Exact timings may be refined.

Do not create unnecessary API traffic.

---

# 11. OTP Extraction Engine

The system needs to identify codes accurately.

Do not simply use:

```regex
\d{6}
```

and choose the first result.

Emails may contain:

- Dates
- Order numbers
- Phone numbers
- Account numbers
- Tracking numbers
- Prices
- Other numerical values

The parser should consider context.

Possible verification phrases:

```text
Your code is
Verification code
Security code
One-time code
OTP
Login code
Authentication code
Confirm your email
```

Support common lengths such as:

```text
4 digits
5 digits
6 digits
8 digits
```

Potential future support:

- Alphanumeric OTPs

Each candidate should receive a confidence score.

Example:

```text
"Your GitHub verification code is 839192."

Candidate:
839192

Signals:
+ nearby phrase "verification code"
+ recent email
+ GitHub sender
+ expected digit length

Confidence:
high
```

---

# 12. Service Detection

OTPGuard must determine which service issued an OTP.

Example:

```text
Sender:
noreply@github.com

Email:
"Your GitHub verification code..."

Detected service:
GitHub

Official domain:
github.com
```

Signals may include:

- Sender email domain
- Sender name
- Email subject
- Email body
- Links contained within the email
- Known service registry

Create a clean service-matching abstraction.

Example conceptual representation:

```ts
interface ServiceDefinition {
  id: string
  name: string
  domains: string[]
  emailDomains: string[]
  senderPatterns?: string[]
}
```

Example:

```ts
{
  id: "github",
  name: "GitHub",
  domains: [
    "github.com"
  ],
  emailDomains: [
    "github.com"
  ]
}
```

Do not blindly trust the human-readable sender name.

---

# 13. Domain Validation

Before autofilling an OTP, compare:

```text
service that issued OTP
```

against:

```text
website currently requesting OTP
```

Example:

```text
GitHub OTP
+
github.com

ALLOW
```

Example:

```text
GitHub OTP
+
github-login-security.xyz

BLOCK
```

Subdomains need correct handling.

Example:

```text
login.microsoftonline.com
```

should not be compared with naive substring matching.

Use proper domain parsing and registrable-domain logic where appropriate.

Never do dangerous checks like:

```ts
hostname.includes("github")
```

because:

```text
github.phishing-site.com
github-login.xyz
realgithubsecurity.com
```

would incorrectly pass.

---

# 14. Phishing Protection

This is one of the most important differentiators of the project.

When the service/domain relationship cannot be verified:

Do not expose the OTP.

Display something like:

```text
OTPGuard blocked autofill

This verification code appears to belong to GitHub,
but the current site is:

github-secure-login.xyz

Expected:
github.com
```

Possible states:

```text
VERIFIED
UNKNOWN
MISMATCH
BLOCKED
```

The default security posture should be:

```text
When uncertain, do not automatically expose the OTP.
```

The user may manually override certain unknown domains in the future.

---

# 15. Autofill Modes

Eventually support:

## Secure Autofill

Automatically fill only if domain verification passes.

## Confirm Before Fill

Show:

```text
GitHub verification code found

[ Fill code ]
```

## Copy Only

Never interact directly with the page.

User manually copies the OTP.

For MVP, Secure Autofill plus a manual-fill option is sufficient.

---

# 16. Auto Submit

Do not enable automatic form submission by default.

Default behavior:

```text
Find OTP
→ Fill OTP
→ User presses Continue
```

Auto-submit may be added as an optional user setting later.

---

# 17. Extension Popup

Initial popup could contain:

```text
OTPGuard

✓ Signed in

Gmail
✓ Connected

Protection
✓ Enabled

Autofill
✓ Enabled

Last action

GitHub
github.com
Verification code filled
20 seconds ago

[ Open Dashboard ]
```

If Gmail is disconnected:

```text
Gmail not connected

[ Connect Gmail ]
```

If on a suspicious page:

```text
⚠ Autofill blocked

The current website does not match
the service that issued the OTP.
```

---

# 18. Next.js Dashboard

The web dashboard should eventually support:

```text
Dashboard
├── Overview
├── Connected Accounts
├── Security
├── Trusted Domains
├── Blocked Domains
├── Activity
├── Devices
└── Settings
```

Example dashboard:

```text
OTPGuard

Security Overview
────────────────────────

24 verification codes filled

3 suspicious autofills blocked

Connected accounts
✓ Gmail

Devices
✓ Chrome — MacBook

Recent Activity

GitHub
github.com
Code autofilled
2 minutes ago

Discord
discord.com
Code autofilled
Yesterday

GitHub
github-login.xyz
Autofill blocked
September 29
```

Do not display or store the actual OTP values in activity history.

---

# 19. Security Event Logging

Logging is allowed for metadata.

Example:

```json
{
  "service": "github",
  "domain": "github.com",
  "action": "autofill",
  "result": "allowed"
}
```

Or:

```json
{
  "service": "github",
  "domain": "github-login.xyz",
  "action": "autofill",
  "result": "blocked",
  "reason": "domain_mismatch"
}
```

Never include:

```json
{
  "otp": "839192"
}
```

---

# 20. Data Minimization

Only request browser and Gmail permissions that are actually needed.

Avoid broad permissions merely because they are convenient.

Document:

- What permissions are requested
- Why each permission is needed
- What information is processed
- What information leaves the user's browser
- What information is stored
- What information is never stored

Privacy should be part of the product architecture, not just marketing language.

---

# 21. Security Threat Model

Create a security/threat-model document.

Threats to consider include:

### Phishing website

Attacker creates:

```text
github-login.xyz
```

and tricks victim into authenticating.

Mitigation:

```text
Service/domain validation
```

---

### Malicious email

Attacker sends:

```text
Your GitHub OTP: 123456
```

Mitigation:

Validate:

- Sender
- Sender domain
- Message context
- Service identity

Do not trust display name alone.

---

### OTP leakage through backend

Mitigation:

Keep OTP processing local where possible.

Do not store OTP values in Convex.

---

### Stale OTP

Mitigation:

Only consider recent emails and expire candidates after a short period.

---

### Wrong-code selection

User has several verification emails simultaneously.

Mitigation:

Use:

- Service matching
- Timestamp
- Domain
- Sender
- Context
- Confidence score

---

### Malicious webpage reading the OTP

Be careful about how the extension exposes data to page scripts.

Minimize the time the OTP exists in extension state.

Document this risk.

---

# 22. MVP Scope

The first working MVP should ONLY need:

### Authentication

- Clerk login

### Email

- Gmail OAuth
- Gmail API integration

### Extension

- Chrome
- Manifest V3
- Plasmo
- React
- TypeScript

### Detection

- Detect likely OTP input
- Detect likely verification page

### Email Processing

- Retrieve recent Gmail messages
- Identify likely OTP email
- Extract OTP

### Autofill

- Single OTP field
- Split OTP fields

### Security

- Identify issuing service
- Validate current domain
- Block obvious mismatches

### Basic UI

- Extension popup
- Login state
- Gmail state
- Autofill state

Do NOT build every planned feature before proving this core loop works.

---

# 23. MVP Success Scenario

OTPGuard MVP is successful when the following works reliably:

```text
1. User installs OTPGuard.

2. User signs into OTPGuard.

3. User connects Gmail.

4. User visits a supported login page.

5. Website emails a verification code.

6. Website shows OTP field.

7. OTPGuard detects the field.

8. OTPGuard retrieves recent Gmail message.

9. OTPGuard extracts correct code.

10. OTPGuard verifies service/domain.

11. OTPGuard fills the code.

12. Code is discarded.

13. Metadata-only event is recorded.
```

---

# 24. Build Order

Follow this order unless implementation discoveries justify changing it.

## Phase 1 — Extension Foundation

Create:

- Plasmo extension
- React
- TypeScript
- Popup
- Content script
- Background service worker
- Messaging between components

Prove that the extension can identify a test OTP field and fill a hardcoded code.

---

## Phase 2 — OTP Detection

Implement:

- OTP page detection
- Single-field detection
- Split-field detection
- Framework-compatible autofill

Build local test pages.

---

## Phase 3 — Gmail

Implement:

- Google OAuth
- Gmail API
- Retrieve recent verification emails
- Controlled retries
- Message parsing

Do not yet focus heavily on dashboard features.

---

## Phase 4 — OTP Extraction

Implement:

- Candidate extraction
- Context scoring
- OTP confidence score
- Expiration logic

Build unit tests with sample email fixtures.

---

## Phase 5 — Service Recognition

Implement initial support for several popular services.

Examples:

- GitHub
- Google
- Microsoft
- Discord
- Amazon

The exact initial list may be adjusted.

Create a reusable registry so services are easy to add.

---

## Phase 6 — Security Engine

Implement:

```text
OTP service
       ↓
Expected domains
       ↓
Current browser hostname
       ↓
VERIFIED / UNKNOWN / MISMATCH
```

Do not autofill mismatches.

---

## Phase 7 — Clerk

Add OTPGuard authentication to:

- Extension
- Web app

Ensure sessions work correctly in extension environment.

---

## Phase 8 — Convex

Add:

- User settings
- Device metadata
- Trusted domains
- Security events

Do not add OTP storage.

---

## Phase 9 — Next.js Dashboard

Create polished dashboard.

Focus first on:

- Overview
- Security events
- Settings
- Gmail connection status
- Devices

---

## Phase 10 — Hardening

Add:

- Unit tests
- Integration tests
- End-to-end tests
- Error handling
- Logging
- Rate-limit handling
- OAuth edge cases
- Security documentation
- CI/CD

---

# 25. Future Features

These are NOT required for initial MVP.

## Version 1.1

Improved phishing detection.

---

## Version 1.2

Magic-link support.

Example email:

```text
Click here to sign into your account.
```

OTPGuard could safely detect and surface the verified link.

---

## Version 1.3

Outlook / Microsoft email support.

---

## Version 1.4

Firefox support.

---

## Version 2

Potential features:

- Passkey recommendations
- Security reports
- Additional email providers
- Smarter service detection
- Local ML classification
- Advanced organization support
- Enterprise policies

---

# 26. Recommended Repository Structure

Prefer a monorepo.

Example:

```text
otpguard/
│
├── apps/
│   ├── web/
│   │   └── Next.js dashboard
│   │
│   └── extension/
│       └── Plasmo browser extension
│
├── packages/
│   ├── security/
│   │   ├── domain-validation.ts
│   │   ├── service-matcher.ts
│   │   └── threat-types.ts
│   │
│   ├── otp/
│   │   ├── parser.ts
│   │   ├── candidate-score.ts
│   │   └── types.ts
│   │
│   ├── shared/
│   │   ├── types/
│   │   ├── constants/
│   │   └── utils/
│   │
│   └── ui/
│
├── convex/
│
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── privacy.md
│   └── development.md
│
├── tests/
│
└── README.md
```

A different structure is acceptable if there is a clear architectural reason.

---

# 27. Coding Standards

Use:

- TypeScript strict mode
- Clear naming
- Small focused functions
- Explicit types at system boundaries
- Modular architecture
- Minimal duplicated logic
- Proper error handling
- Comments only where they explain why, not obvious code
- Environment variables for secrets
- No credentials committed to Git

Prefer:

```ts
extractOtpCandidates(email)
```

over large functions that retrieve, parse, validate, and autofill everything at once.

Keep the pipeline modular:

```text
retrieveEmail()
      ↓
classifyEmail()
      ↓
extractOtp()
      ↓
identifyService()
      ↓
validateDomain()
      ↓
authorizeAutofill()
      ↓
fillOtp()
```

Each stage should be testable independently.

---

# 28. Testing Expectations

Create meaningful tests.

## OTP parser tests

Test:

```text
Your code is 839192
```

Expected:

```text
839192
```

Test:

```text
Order #839192
Your verification code is 428107
```

Expected:

```text
428107
```

---

## Domain tests

Expected safe:

```text
github.com
www.github.com
```

Expected unsafe:

```text
github-login.xyz
github.com.phishing.example
secure-github.example
```

---

## Input tests

Test:

```text
single field
split 6 field
split 4 field
React-controlled input
```

---

## Security tests

A GitHub OTP must never automatically fill on:

```text
attacker.example
```

even if the page contains:

```text
GitHub Login
```

---

# 29. UX Principles

The extension should feel fast and invisible when everything is safe.

Normal experience:

```text
Code email arrives
        ↓
OTPGuard identifies it
        ↓
Field fills
        ↓
Small confirmation
```

Avoid excessive popups.

Warnings should only become prominent when there is a security concern.

---

# 30. Design Direction

UI should feel like a real modern security product.

Desired qualities:

- Minimal
- Clean
- Professional
- Dark/light mode
- Security-focused
- Not overly flashy
- Clear status indicators

Avoid making the project look like a generic student dashboard.

Use shadcn/ui thoughtfully rather than relying completely on default component styling.

---

# 31. Portfolio Requirements

This project is intended to be shown to software engineering and cybersecurity employers.

The repository should eventually have an excellent README containing:

```text
OTPGuard
Privacy-first email OTP autofill with phishing protection.

Demo
Architecture
How it works
Security model
Threat model
Privacy model
Technology stack
Installation
Development
Testing
Screenshots
Future roadmap
```

The README should explain engineering decisions, not merely installation instructions.

---

# 32. Key Portfolio Story

The important story behind OTPGuard is:

> Email OTP autofill already exists, but blindly autofilling authentication codes creates security risks. OTPGuard adds a security layer that identifies the service issuing a code, validates the website requesting it, and refuses to expose verification codes to suspicious domains.

This distinction should remain central throughout implementation.

---

# 33. Important Constraints

Do not:

- Permanently store OTPs.
- Log OTP values.
- Send OTP values to analytics.
- Request unnecessarily broad permissions.
- Trust sender display names.
- Use naive hostname substring matching.
- Automatically submit forms by default.
- Treat Clerk login as Gmail authorization.
- Build the entire dashboard before proving OTP autofill works.
- Create unnecessary backend infrastructure for OTP processing.
- Add AI merely for marketing purposes.

---

# 34. Engineering Decision Priority

When making decisions, prioritize in this order:

```text
1. Security
2. Privacy
3. Correctness
4. Reliability
5. Maintainability
6. User experience
7. Performance
8. Additional features
```

Do not sacrifice security for an easier implementation.

---

# 35. Instructions for Codex

Act as the primary implementation engineer for this project.

Before making major architectural changes:

1. Review this document.
2. Preserve the core privacy/security model.
3. Prefer modular, production-quality solutions.
4. Do not unnecessarily increase infrastructure complexity.
5. Keep OTP processing local whenever practical.
6. Write tests alongside important security/parsing functionality.
7. Document significant architectural decisions.

When working on a feature:

```text
Understand requirement
        ↓
Inspect existing architecture
        ↓
Implement smallest clean solution
        ↓
Add/update tests
        ↓
Run validation
        ↓
Fix errors
        ↓
Document important decisions
```

Do not blindly generate large amounts of code.

Favor correctness and maintainable architecture.

If existing code conflicts with this specification, determine whether:

```text
A. Existing code is intentionally implementing a better design

or

B. Existing code has drifted away from the intended architecture
```

Preserve better implementations when they maintain the project's core requirements.

---

# 36. First Implementation Milestone

Start with the smallest vertical slice possible.

Build:

```text
Plasmo Chrome Extension
        ↓
Detect OTP field
        ↓
Hardcoded test OTP
        ↓
Autofill field
```

Then build:

```text
OTP field detected
        ↓
Mock verification email
        ↓
OTP parser
        ↓
Service identification
        ↓
Domain validation
        ↓
Autofill
```

Only after this pipeline works should Gmail OAuth be introduced.

This will separate browser-extension problems from Gmail/OAuth problems and make debugging significantly easier.

---

# 37. Definition of Done for First Major Prototype

The first major prototype is complete when:

- Chrome extension installs successfully.
- User can authenticate.
- Gmail can be connected.
- Verification-code pages can be detected.
- Recent Gmail verification emails can be retrieved.
- OTPs can be extracted reliably from supported emails.
- Issuing service can be identified.
- Current domain can be validated.
- Matching domains receive autofill.
- Domain mismatches are blocked.
- Single and split OTP inputs work.
- OTPs are not persisted.
- Security events contain metadata only.
- Basic extension UI exists.
- Core parser/security logic has automated tests.
- README explains architecture and security model.

At that point the project should already be demonstrable as a portfolio prototype.