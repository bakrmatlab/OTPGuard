# ADR 0025 — Present the popup at email-code detection

Date: October 5, 2026. Status: local implementation requested by owner.

Previously the automatic popup opened when candidate confirmation became available,
so account/mailbox/delivery latency left the OTP screen without visible progress.
The owner requested opening when the supported screen appears.

Add an optional coordinator presentation callback for validated automatic detect
messages. It runs independently of provider admission with the same admission abort
signal. The worker validates current foreground browser metadata and local settings,
permission and block policy before trying Chrome's existing action-popup API. Deduplicate
early attempts by document/URL/field group in volatile worker memory.

Opening is not authorization. No Gmail/code retrieval or release is delegated to the
callback; all existing admission and Fill checks still apply. Its failure is caught
without altering authorization. Manual requests stay manual, and code-ready fallback
remains. New windows, notification permissions, artificial worker keepalive and any
secret persistence are unnecessary. The owner must still test automatic opening in
installed Chrome; browser refusal cannot be represented as successful opening.

Synthetic worker/coordinator regressions prove the early ordering, right window,
deduplication, cancellation/policy refusal and absence of release without confirmation.
See detection-time-popup-acceptance.md for validation.
