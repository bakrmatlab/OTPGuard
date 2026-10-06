# Generic filling reliability work

Owner requested the ranked fixes on October 5, 2026, after the audit of `09488b5`.
This document tracks that request. It does not authorize publishing, merging,
deployment, live browser/mailbox access, or starting a second scope before review.
Repository instructions require one reviewable scope at a time.

| Order | Scope                         | Status                              | Required evidence                                                                                                |
| ----- | ----------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | Parser false refusals         | Owner-approved for merge            | Metadata/disclaimer successes; genuine ambiguity and unsupported-purpose refusal; composed click-bound retrieval |
| 2     | Detection and manual recovery | Owner-approved for merge            | Active-challenge context; safe explicit recovery for uncertain email flows; payment/TOTP refusal                 |
| 3     | Challenge/resend tracking     | Local implementation for review     | Fresh/resend/retry separation; cancellation; concurrent-request refusal without unrelated interference           |
| 4     | Timing and provider checks    | Local implementation for review     | Slow authority/delivery cases; usable approval budget; no stale-authority release                                |
| 5     | Retrieval/MIME coverage       | Local implementation for review     | Bounded complete plausible sets; busy mailbox and decoder failures; no hidden competition                        |
| 6     | Recipient parsing             | Queued                              | Structured address variants and aliases; conservative uncertainty; real contradiction refusal                    |
| 7     | Input compatibility           | Queued                              | Framework state, split/replaced controls, delayed clearing, user typing and site-driven submission               |
| 8     | Recovery/updates              | Queued                              | Worker/content reload, uncertain delivery, clear recovery and replay protection                                  |
| 9     | Broader supported scope       | Queued; contract decisions required | Individually accepted language/format/frame/provider categories                                                  |

The metric is correct current-code filling into the intended field after explicit
Fill confirmation. Server login completion is separate owner-controlled evidence.
A wrong selected code counts as failure, and expected safe refusals are recorded
separately instead of being presented as successful fills. Synthetic tests establish
regression behavior, not a representative 99% live success rate.

Scope 1 adds a small synthetic structural corpus and composed integration cases.
Later scopes should extend the same distinction between detection, retrieval,
selection, confirmation, insertion and owner-reported site completion. No live mail,
code or token goes into metrics, logs, test fixtures, persistent storage or backend
traffic. The eventual live benchmark requires representative owner-controlled trials
and a defined browser/provider/format population; none has been executed here.

Before rank 3, the owner requested letter-only/mixed ASCII codes. This local
format extension is implemented and awaiting review; see
[acceptance](alphanumeric-otp-acceptance.md) and [ADR0024](adr/0024-generic-alphanumeric-codes.md).

The owner-reported grouped confirmation email is repaired within this format
follow-up: explicit three-plus-three hyphen grouping and introductory-word refusal,
with 599 tests and 23 browser checks passing. Rank 3 is still queued.

The subsequent owner-requested systematic format matrix checks 34,775 generated
success scenarios plus negative cases and extends native-field browser coverage.
It exposed additional connector, punctuation, prose and fragment-selection bugs;
see [matrix acceptance](otp-format-matrix-acceptance.md). Rank 3 stays queued.

The next owner screenshot stopped at write-ahead replay protection. Detailed local
refusal messages now distinguish earlier reservation from storage unavailability,
without clearing history or enabling reuse. The original fresh-versus-retry cause
is pending owner input; see [diagnostics acceptance](replay-diagnostics-acceptance.md).

An owner-reported competing-email screen led to a reproduced new-code gesture gap:
“Request a new code” did not establish the existing fresh window. Generic gesture
coverage and recovery copy are repaired, while genuine fresh-window competition
remains refusing. See [acceptance](new-code-gesture-acceptance.md). This does not
claim all challenge/resend scope is complete or authorize starting another scope.

On October 5, 2026, the owner explicitly authorized committing, merging and pushing
all completed local reliability and follow-up fixes. That authorization covers the
implemented changes and acceptance reports, not the queued reliability scopes,
live mailbox access or deployment.

## Ranked backlog continuation — October 5, 2026

After the separate local CI assertion repair, the owner requested continuation.
Challenge/resend tracking is now implemented locally for review in its own branch:
[acceptance](challenge-tracking-acceptance.md) and
[ADR0026](adr/0026-volatile-challenge-ordering.md). This does not resolve server
transaction identity, same-mailbox concurrent login ambiguity or late old-mail
identity. Timing/provider changes are not started.

The owner's subsequent instruction authorized committing, merging and pushing the
CI/challenge scopes and then starting timing/provider work. Those first scopes are
integrated; the separate timing scope is implemented locally for review. See
[timing acceptance](timing-provider-acceptance.md) and
[ADR0027](adr/0027-bounded-confirmation-and-release.md). Retrieval/MIME backlog work
has not started. The current delegated rank numbers include CI as rank 1, challenge
tracking as rank 2 and timing as rank 3; the historical table above preserves its
original parser-first numbering.

The owner authorized rank 3 commit/merge/push and then local rank 4 in this new chat.
Rank 3 is published as `5e3accc`; Linux run 37402477865 passed all steps. Delegated
rank 4 bounded retrieval/MIME coverage is implemented locally for review on
`codex/bounded-retrieval-mime`. Historical row 5 above corresponds to this scope.
See [rank-4 acceptance](retrieval-mime-acceptance.md) and
[ADR0028](adr/0028-bounded-complete-generic-retrieval.md). No subsequent recipient,
input/recovery/scope work, publication, provider action or live success claim is included.

## Delegated rank 5 — recipient parsing

Rank 4 is integrated and published as `5d527f6`; prerequisite Linux CI
[37404175125](https://github.com/bakrmatlab/OTPGuard/actions/runs/37404175125) passed
all steps on that exact commit, including browser/packaging. The owner requested local
rank 5 in this new chat. It corresponds to historical recipient row 6 above and is
implemented on `codex/recipient-parsing` for review. See
[acceptance](recipient-parsing-acceptance.md) and
[ADR0029](adr/0029-structured-recipient-hints.md). No later input/recovery/scope work,
rank-5 publication, provider/live profile access or deployment is authorized/performed.

The owner reported a configured popup still searching at 117 seconds after reinstall.
A separate local follow-up repairs reproduced refusal/display-expiry and inconsistent
foreground admission, preserving the completed rank-5 recipient scope and all release
rules. See [acceptance](popup-admission-repair-acceptance.md) and
[ADR0030](adr/0030-finished-and-bounded-admission-display.md). This is not the next
queued input-compatibility rank or permission to publish/deploy. Live retest is pending.

## Delegated rank 6 — input compatibility

The owner requested historical row 7 in a new chat after published popup/default
follow-up `a103a6d`. Local implementation on `codex/input-compatibility` is ready for
validation/review; see [acceptance](input-compatibility-acceptance.md) and
[ADR0032](adr/0032-bounded-input-retention.md). Rank-5 CI passed; exact a103a6d CI failed
on prior report formatting, corrected locally. No rank-7 recovery/updates, publication,
provider/live profile access or deployment is included.
