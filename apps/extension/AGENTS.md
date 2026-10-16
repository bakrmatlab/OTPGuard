# Extension

- The background worker can stop at any moment. Requests and approvals are
  memory-only by design; anything that must survive goes to `chrome.storage.local`
  with `TRUSTED_CONTEXTS` access, and must be listed in `documentation/privacy.md`.
- Message boundaries are checked in `background.ts`: page content scripts, the popup
  (the only Fill authority), Options (`management.html`, settings and history only)
  and the website (`website-management*.ts`, exact origin and Clerk session). Keep
  each schema closed; never widen one sender's rights to another's.
- After every await, the coordinator rechecks tab, document, origin, focus, account,
  mailbox and settings. Keep that pattern when adding steps.
- Content script registration ID `otpguard-pilot` is stored by Chrome. Do not rename it.
- Build output goes to `build/chrome-mv3-prod`; there is no hot reload. Rebuild, then
  reload the unpacked extension in `chrome://extensions`.
- Unit tests: `apps/extension/tests/`, synthetic mail from `tests/fixtures/email.ts`.
- Use the `chrome-extensions` skill for MV3 APIs and the
  `clerk-chrome-extension-patterns` skill for Clerk Sync Host and `createClerkClient`.
