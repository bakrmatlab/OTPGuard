# ADR0032 — Bounded retained insertion and edit invalidation

Date: October 6, 2026. Local reliability rank 6; owner review pending.

The input compatibility investigation reproduced three false insertion acknowledgments:
clearing at 200 ms after the existing 100 ms check, a changed pattern which the retained
check did not enforce, and an input event changing then restoring the expected value.
A production-content regression also establishes that typing and clearing between
scans must invalidate the original request, during search as well as after prepare.

Use the existing native setter and beforeinput/input/change sequence. After synchronous
insertion succeeds, observe input/beforeinput/change events and check retention every
25 ms for twenty checks (nominally 500 ms). Any observed edit, changed field identity,
constraint mismatch, hidden document or detector limit refuses acknowledgment. Listener
cleanup runs on success/failure. The content script invalidates a selected search or
prepared binding on an edit, even if the value subsequently returns to empty. A manual
retry must establish a fresh binding and confirmation. No code is reinserted or erased.

This finite observation is evidence of retained DOM values, not framework internals,
server acceptance or permanence. React fixtures independently assert framework state.
Page mutations without input events between polls can escape observation. Browser timer
throttling can extend elapsed time; the worker's existing release deadline still bounds
its waiting and authorization. Clearing after the window remains possible. Frameworks
which replace controls or emit delayed synthetic input events may conservatively refuse.
Sites that complete or remove fields on input can succeed on their own while the
extension reports uncertain insertion. It never initiates submission or clicks submit.

An unrelated-looking composed browser failure was reduced to advancing clock reads
between a recorded confirmation offer/click and its deadline calculation. Derive phase
deadlines from those recorded timestamps. This restores the existing strict 30/15-second
limits without relaxing policy or caching authority; an incrementing-clock regression
failed before and passes after the correction.

Extending indefinitely, retrying until values persist, rollback, transferring approval
to replacement controls, or synthesizing keyboard/page-world helpers would risk
user/page changes or broaden release. None is adopted. Fields remain native top-level
inputs; iframe/shadow/language/provider expansion stays outside this scope. No new
permissions, persistence, grants, mail processing, logging or backend traffic.

See [input compatibility acceptance](../input-compatibility-acceptance.md) for actual
checks, failures, limits and synthetic owner-retest steps.
