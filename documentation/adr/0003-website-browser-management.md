# ADR 0003: The website manages this Chrome profile's extension

## Decision

The otpguard.net dashboard talks to the extension through Chrome external messaging.
The manifest's `externally_connectable` has `ids: []` and one exact HTTPS origin. The
worker also requires the top-level `/dashboard` document, no query string, frame 0,
and Clerk user and session IDs that match a fresh check of the extension's own
session. It handles one request at a time with a 60 s deadline and holds its lock
until the action settles. The dashboard stops waiting after 90 s.

Allowed actions: status, automatic finding, exact HTTPS blocks, Gmail connect and
disconnect, history export and delete, and opening Options. The website cannot
retrieve codes, see pipeline status, confirm, retry or Fill. Chrome's site-access
prompt stays in Options.

## Why

Users wanted to manage the extension from the website. Cloud sync would add a
backend and data retention, and could not grant this browser Gmail access anyway.

## Consequences

- The dashboard and its scripts are trusted for these actions. XSS on otpguard.net
  could change settings or read mailbox address, blocks and history metadata, but
  never codes or tokens.
- The page holds this metadata in memory only; it makes no backend calls with it.
- An action already sent to Chrome storage or Google cannot be rolled back if the
  user signs out while it completes.
