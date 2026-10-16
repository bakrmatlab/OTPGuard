# ADR 0002: Generic codes, released only after a Fill click

## Decision

OTPGuard has no per-site or per-sender configuration. It searches all recent Gmail
mail in the request window and treats a single plausible code as a CANDIDATE, never
as verified. The extension popup shows **Fill**, and only that click releases the
code to the bound page. There is no automatic insertion and no remembered
site-to-sender mapping.

Website detection needs one optional `https://*/*` grant, requested from an explicit
setup button that explains the limitation first.

## Why

A registry of reviewed senders and sites needed authenticated sender and receipt
evidence for every service, and only one pilot service was ever added. Generic
matching works on any site; the click leaves the one remaining trust decision with
the user.

## Consequences

- Nothing proves an email belongs to the current login. A page can trigger a real
  code and receive it if the user clicks Fill. No phishing protection is claimed.
- Spoofed recent mail, replayed copies and another login's code remain risks.
  Ambiguity refusal, the receipt window, the release ledger and local blocks reduce
  them.
- All generic requests share one bucket, so two sites cannot each take the same
  candidate.
- Activity history records generic fills with a null service ID, never site names.
