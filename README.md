# OTPGuard

OTPGuard finds recent Gmail verification codes in your Chrome profile and offers
**Fill** when you choose to insert one. The website is live at
[otpguard.net](https://otpguard.net).

The dark website and minimal extension popup include guided setup, Gmail connection,
website permissions, local preferences, exact website blocks, and local activity
management. Gmail tokens, messages and codes stay inside the extension.

Recent-mail matching does **not** verify that a code belongs to the current website.
Only choose Fill on a page you intended to use. OTPGuard never initiates submission,
but a website may continue automatically after its fields are filled.

## Set up in Chrome

The extension is currently installed **unpacked**; a Chrome Web Store release is not
available yet. Use the configured extension package provided for this release.
A default source build is credential-free and cannot connect to production providers.

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**,
   and select the configured extension folder. For an existing installation, choose
   **Reload** after its build files are updated. Pin OTPGuard to the toolbar.
2. Open [your workspace](https://otpguard.net/dashboard) and sign in to OTPGuard.
3. Choose **Connect this browser**. The dashboard shows the remaining setup step.
4. Choose **Connect Gmail** and approve read-only access to the mailbox that receives
   your codes. Your OTPGuard account and Gmail mailbox may be different.
5. Choose **Enable website access**. In the extension settings that open, click the
   same action and approve Chrome's permission prompt. Return to the workspace;
   its status refreshes when you return.

Gmail access and website access are separate permissions. Setup stays incomplete
until the extension reports both. Once ready, open a page asking for an email code;
OTPGuard finds it and you click **Fill**. If automatic finding is off, choose
**Find code** in the popup or enable it in Preferences. Reload an existing login
page after granting website access.

You can also right-click OTPGuard's toolbar icon and choose **Options**. The remaining
setup action appears at the top, with account, Gmail, permissions and advanced local
settings below it.

## Website and extension controls

| Location          | Available actions                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Popup             | Current status, Find code, Retry, required Fill, and named setup actions                                                |
| Website workspace | Guided setup; Gmail connect/disconnect; automatic finding; exact HTTPS blocks; local activity status, export and delete |
| Extension Options | Guided setup, account and Gmail controls, website permission prompt, preferences, blocks and local activity             |
| Homepage demo     | Interactive made-up-code example; no mailbox, sign-in or submission                                                     |

Website management requires the configured extension in the same Chrome profile,
the same authenticated OTPGuard session, and the production dashboard at
`https://otpguard.net/dashboard`. Connecting shares mailbox status, preferences,
blocks and sanitized activity metadata with that page. Codes, mail and credentials
are never shared; the website cannot retrieve or fill a code. Local previews cannot
connect to the production extension. Chrome's website permission prompt remains in
extension-owned Options.

## Coverage and limitations

Generic user-confirmed matching supports numeric, letter-only and mixed ASCII codes
of 4–8 characters with English code wording. Exact case and leading zeros are
preserved; a three-plus-three hyphen display becomes six characters for filling.
Single and split light-DOM fields are exercised with synthetic fixtures.

Broad live website compatibility remains unverified. No reviewed sender-to-website
trust claim is made. Ambiguous candidates and changes to the account, mailbox,
page, fields or permission can stop a request. Iframes, shadow roots,
symbol-containing or longer codes, magic links, multiple mailboxes, incognito and
Firefox are outside current coverage. Email OTPs are not phishing-resistant; a page
receiving an input value can read it.

Preferences and retained activity are local to this Chrome profile. Cloud activity
upload is disabled. Gmail disconnection attempts Google project-wide revocation;
this is separate from signing out of OTPGuard. Google restricted-scope verification,
assessment applicability and Chrome Web Store review remain unresolved. A deployed
website does not establish approval for public extension distribution.

## Develop and validate

Use Node **22.19.0** and Bun **1.4.2**, with ports **3100** and **3001** free.
From a fresh clone without provider environment files or exported provider variables:

```sh
bun install --frozen-lockfile
NEXT_TELEMETRY_DISABLED=1 bun run build
bun run build:mock
bun run check
bun x --no-install playwright install chromium
bun run test:browser
```

On Linux, install browser prerequisites with
`bun x --no-install playwright install --with-deps chromium`.
Builds must precede checks because tests inspect generated artifacts. These checks
use synthetic fixtures and require no provider credentials. See
[setup and demo](documentation/setup-demo.md) for configuration precautions and
troubleshooting. Extension hot reload is unavailable; rebuild and reload in Chrome.

For credential-free review archives, with `zip`/`unzip` installed and port **3201** free:

```sh
bun run package:review
bun run check:packages
```

Release `2bd9b74` is deployed to production. Its
[CI run](https://github.com/bakrmatlab/OTPGuard/actions/runs/37436593068) passed
both production builds, types, lint, formatting, dependency audit, **813 unit tests**,
**89 browser tests**, and extracted-package checks. One configured live Gmail test
was skipped. Automated synthetic results are separate from owner-controlled live
provider, consent and end-to-end filling acceptance.

Source layout: `apps/extension` (Bun MV3/React 18), `apps/web` (Next.js/React 19),
`packages/otp` and `packages/security` (pure logic), `packages/shared` (contracts),
`convex` (backend), `development/mock-extension` and `tests/fixtures` (synthetic only).

## Engineering references

- [Architecture and security decisions](documentation/architecture.md)
- [Privacy and data handling](documentation/privacy.md)
- [Threat model](documentation/threat-model.md)
- [Guided setup and spacing acceptance](documentation/guided-setup-acceptance.md)
- [Website management acceptance](documentation/website-management-acceptance.md)
- [Generic matching acceptance](documentation/generic-fill-acceptance.md)
- [Domain-hosted shared authentication](documentation/domain-auth.md)
- [Packaging and public distribution gates](documentation/release-readiness.md)

Older milestone reports describe the state at their review date and may predate
production authentication, generic retrieval, website management and deployment.
