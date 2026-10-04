# ADR 0017: Bind explicit Gmail connection to the shared account session

Date: October 4, 2026. Status: accepted for Core 1; owner approved merge and push.

## Problem

The production Clerk auth artifact and earlier Gmail artifact have different IDs.
The existing lifecycle validates Gmail independently, but popup connection actions
could run without a fresh OTPGuard account. A switched Clerk session could inherit
an already displayed mailbox. The owner requires one controlled combined artifact,
with the old extension, grant and owner configuration preserved.

## Decision

Reuse the Chrome identity lifecycle behind a worker-only authenticated mailbox
controller. Require a fresh Clerk binding before Connect or Check, then revalidate
it after the Google operation. Account invalidation cancels the mailbox lifecycle;
changed user/session refuses inheritance until explicit Disconnect. Gmail and Clerk
email addresses need not match. Both identities remain separately visible.
Disconnect cleanup remains possible while signed out. No new identity, mailbox or
credential persistence is added. Worker restart starts disconnected and does not
probe Google's cache until explicit Connect. Session expiry may pause an otherwise
valid Google grant; this intentionally requires another explained Connect action.

Register a separate Chrome-extension client for the reviewed auth ID, using the
existing project. Keep the old client and artifact. Build from reviewed public
configuration in a new isolated export; exclude env files and refuse existing output
directories. The stable-ID/key build guard is unchanged. No client secret is needed.

## Provider evidence and consequences

The owner approved the exact new OAuth client and Chrome loading at action time.
Console readback confirmed the old client's Item ID and both clients' existence.
The project remains External/Testing with one owner test user. The owner confirmed
that the mailbox shown after explicit Connect is intended. Google reused existing
authorization with no new consent screen; new-consent/denial acceptance is unverified.
This is provider project authorization reuse, not app copying a token or migrating
the old extension's cache. No forced reconsent is attempted to manufacture evidence.

Google revocation is project-wide across scopes and clients. Therefore live revoke
and disconnect are deferred to preserve the owner's old grant. The popup explains
this breadth and asks for confirmation before disconnect. A separate project could
isolate future revocation, but requires a separately approved provider setup and fresh
consent; it is not provisioned in this scope. See [Google's revocation documentation](https://developers.google.com/identity/protocols/oauth2/native-app).

## Alternatives

Reusing the old extension ID would break the already accepted exact Clerk origin.
Editing the old Google client would jeopardize its existing installation. Treating
Clerk email equality as mailbox authorization would exclude valid independent accounts.
Persisting the mailbox/Clerk binding to silently reconnect after restart would weaken
the established lifecycle. None is used.

## Verification

Fresh-account, switched-session, delayed-consent/logout and restart regressions cover
the controller with synthetic adapters. Existing denial/scope/revoke/cache/mailbox tests
remain. Actual Chrome confirms stable ID, shared Google-authenticated account, fresh
Convex identity, explicit connection, owner-confirmed mailbox and disconnected state
after reload. Full live privacy/lifecycle audit is not inferred from these checks.
See [Core 1 acceptance](../core-1-acceptance.md).

## Connection/status race repair

A live Connect refusal while the account label remained signed in was reproduced
with stable synthetic identity: periodic status refresh could supersede Connect's
in-flight authoritative read. Serialize popup account/mailbox checks, connection
operations and identity probes, and skip timer polls while work is active. Logout
stays outside that queue to cancel immediately. The worker's strict latest-read and
session-generation semantics are unchanged; no transient/provider error is hidden
by an automatic consent retry. The deterministic regression was red before the
queue repair and green afterward. Competing separate popup instances may still
refuse safely; this is not instant or global provider-session synchronization.
