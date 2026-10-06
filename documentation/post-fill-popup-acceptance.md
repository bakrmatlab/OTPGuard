# Post-Fill popup status correction

Owner reported that Fill works but then the popup shows “Request unavailable”.
A synthetic production-popup regression reproduced the fallback heading for the
coordinator's CANDIDATE state after pending confirmation clears. VERIFIED was also
unmapped. This is a display error, independent of whether a site accepts login.

## Change

Fill immediately enters FILLING and disables the button. The command's true reply
means confirmation was accepted, not that insertion succeeded; it no longer resets
the popup to searching. Coordinator CANDIDATE/VERIFIED states display “Completing
your request”. A stale READY response for the clicked request cannot enable another
click. Different subsequent request IDs remain usable.

The actual FILLED acknowledgement still controls “Code inserted”. A declined Fill
shows stopped; a lost command response shows “Insertion could not be confirmed”,
without claiming failure or success and without automatic retry. Existing field,
account/document, expiry and replay gates are unchanged. Site-driven navigation can
still prevent an insertion acknowledgement; DOM insertion never proves server login.
No code, mail content or credential is added to popup state or persistence.

## Validation

The compact production-popup browser test first failed on the missing transitional
heading. Its corrected fixture covers a delayed command, an actual stale READY poll,
CANDIDATE transition, accepted acknowledgement, declined confirmation and rejected
response. The other popup storage/error, native-width and permission-setup tests
remain in scope. `bun run check` passes types, lint, formatting and 630 tests.
Provider-free and configured builds pass, and `git diff --check` passes.
`bun run test:browser tests/browser/popup.spec.ts` passes all four popup tests,
including the expanded delayed/stale/declined/lost-response handoff regression.

Validation is synthetic; the owner confirmed the prior real fill works, while the
updated live popup display awaits owner retest. Configured review build:
`/tmp/otpguard-detection-recovery-review/apps/extension/build/chrome-mv3-prod`.
No publication, merging, deployment, permissions or provider access was performed.
