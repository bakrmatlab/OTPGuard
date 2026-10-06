# ADR0031 — Automatic finding defaults on for new installations

Status: owner-requested addition to the local popup/default review, October 6, 2026.

The owner reported that automatic finding worked after checking “Automatically find
codes and show the Fill prompt”, then requested this behavior without needing to check
that box. Initialize that preference to true only when trusted local settings storage
is genuinely absent and the fresh settings record can be saved successfully.

Keep previously saved settings, including explicit opt-outs and site blocks. Pre-init,
corrupt, unreadable or unwritable settings remain unavailable/disabled. The shared
historical/cloud default stays false; this is a local installation UX default, not
cloud enablement or a schema migration. The checkbox remains an optional way to stop
automatic finding; users need not touch it to enable a new installation.

Automatic finding means bounded local mail retrieval and offering the extension's Fill
prompt after account/mailbox/site permission and supported page checks. It does not
insert a code automatically. Required Fill, fresh release authority, ambiguity/refusal,
replay and no extension submission remain unchanged. Chrome site permission and explicit
Gmail consent are still required. No grants are requested by settings initialization.

Overwriting saved opt-outs or treating invalid storage as a fresh install would erase
user intent and failure boundaries. Changing all shared defaults would affect inactive
cloud contracts unnecessarily. Removing Fill would violate the accepted release
contract. None is adopted. Existing manual Find code / Retry remains available.

No new storage key/field, account mapping, logging, backend transport, provider scope or
permission is introduced. Existing boolean/installation UUID/blocks are stored as before.
With configured and permitted providers/pages, a new installation now starts bounded
mail finding without a separate preference click; that behavior is the owner's request.

Verification: fresh durable initialization and saved-opt-out unit cases; unchanged
storage-error/refusal regressions; actual isolated MV3 popup starts checked with no
HTTPS grant and disabled Fill, and a user opt-out persists after reload. See
[acceptance](popup-admission-repair-acceptance.md). Earlier owner-reported resolution
is separate from live acceptance of this new default artifact.
