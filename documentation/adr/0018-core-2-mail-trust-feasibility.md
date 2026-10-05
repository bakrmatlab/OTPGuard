# ADR 0018: Core 2 stops at the mail trust feasibility gate

Date: October 4, 2026. Status: proposed for owner review; no contract relaxation.

## Problem

Core 1 provides a connected mailbox, but Core 2 needs defensible authenticated
sender and direct-receipt evidence before registering a real service. OpenAI is
an owner-selected candidate, not a supported integration. The existing signed-in
Chrome session reaches the ChatGPT homepage, not an email challenge. No live
message, template, extraction equality or input event behavior has been accepted.

## Evidence and limits

The [sender research](../core-2-sender-research.md) and
[independent boundary verification](../core-2-boundary-verification.md)
separate public provider contracts from protocol guarantees and experiments.
The public Gmail Message schema exposes headers/raw bytes and internalDate, but
no documented authenticated SMTP/import discriminator. Insert/import provide
alternative mailbox creation paths. Header order, authserv-id, pass strings,
labels, history updates and fresh internalDate do not establish direct receipt.
This is a finding about reviewed public contracts, not proof that Google cannot
provide a stronger supported boundary.

A valid service DKIM signature can authenticate covered content and signer;
it cannot by itself prove this message instance arrived directly or is a new
challenge. A copied signed message can retain its signature. A Gmail ARC seal
must likewise be evaluated for exactly what it attests and its binding to the
current message instance, rather than treating a valid chain as direct delivery.
Sanitized bytes cannot retain the original cryptographic verification claim.
No live forged/import/replay experiment was performed, and none is reported passed.

## Decision

Use Core 2's explicit feasibility deliverable. Preserve ADR0009's UNKNOWN sender
and unverified receipt, empty production registry and disabled real fill. Do not
add a nominal OpenAI policy, template or signing-domain mapping without evidence.
Do not add DNS endpoints, provider scopes, mail-processing servers or verifier
code merely to produce an apparently working demo. Normal owner login remains
available outside OTPGuard. Core 3 activation remains blocked by this gate.

No real-mail retrieval is needed to establish the missing public contract. Reading
one genuine message could validate its template but could not prove a universal
receiver boundary. Preserve the owner's signed-in session and existing grants.

## Owner-selectable alternatives

1. **Preserve the contract:** obtain a provider-supported attestation binding sender,
   receipt path/time and recipient to the current mailbox message instance. Require
   documented handling of inserted, imported and forwarded copies, then validate
   genuine and adversarial mail. This needs provider evidence currently unavailable.
2. **Revise to signer/content authentication:** approve a separate local raw-DKIM
   prototype with exact service signer/From/recipient mappings, signed freshness,
   full-body coverage, duplicate-header rejection and bounded key lookup. Explicitly
   accept that direct receipt and replay exclusion are not established. Validate
   those residual risks and restart dedup before any release. This is the most
   concrete local engineering route, but changes the current contract and is not
   authorized or implemented here. No claim of current challenge binding follows.
3. **Change architecture:** require a service-issued signed challenge bound to the
   website transaction or a controlled receiving boundary. This requires service
   cooperation/new integration. Server-side OTPGuard mail processing conflicts with
   the local-only invariant and would need a separately approved privacy redesign.
4. **Retain the connection-only pilot:** keep ordinary user login and unsupported
   status; do not promise real autofill until a stronger boundary exists.

Approving this finding does not select or authorize an alternative. Any revised
contract needs its own reviewed design and evidence; switching candidate brands
alone does not resolve Gmail receiver provenance.

## Consequences and verification

Core 2's feasibility output is reviewable; real-flow acceptance is unverified.
No runtime, registry, permission, storage or installed artifact changes occur.
The existing synthetic sender/normalization/policy suites pass 108 tests on the
Core 1 source. These prove conservative mechanics, not live provider behavior.
See [Core 2 acceptance](../core-2-acceptance.md) for exact checks
and a reproducible review procedure. Core 1's deferred live checks remain deferred.

## Owner-selected follow-up

After the feasibility report, the owner selected the local DKIM prerequisite route.
[ADR0019](0019-local-dkim-prototype.md) proposes its narrower pilot claim and records
the isolated implementation. This supersedes only the statement that no prototype
is authorized; direct receipt remains unproved and production stays disabled.
