# Core 2 live candidate: Slack email sign-in

October 4, 2026. Owner requested a different real site and a direct OTP test.
This records sanitized observations only, not supported-service registration.

## Observed

- Opened `https://slack.com/signin` in a new regular Chrome tab; initial form offered
  an email field and Sign In With Email. No owner OpenAI logout was needed.
- Owner requested the email directly and confirmed it arrived in Gmail.
- Actual Slack challenge displayed “We emailed you a code” and a “6-digit
  confirmation code” group with six separate editable fields, labeled digit 1
  through digit 6. The challenge is on the Slack site, not an OTPGuard fixture.
- Observation withheld all field values, recipient text and mail content. OTPGuard
  did not retrieve or fill a code. Owner was asked to enter it directly and report
  acceptance, numeric-only format and sender address without sharing the code.

[Slack's first-party sign-in instructions](https://slack.com/help/articles/212681477-Sign-in-to-Slack-Sign-in-to-Slack-Sign-in-to-Slack)
document requesting an email confirmation code from this sign-in flow. This does
not authenticate a particular email or establish its code lifetime/signing mapping.

## Owner-confirmed result

The owner confirmed the code was accepted and contained **all letters**. Slack's
UI label “6-digit” did not establish numeric format. This actual flow is therefore
outside the current numeric-code scope and is not selected for the first supported
service. Sender address was not supplied and remains unverified. Original message MIME/template extraction and raw DKIM signer/key/
signed recipient/freshness remain unverified. No raw mail, code, screenshot or
credential is stored in this record. Input-event compatibility with extension
insertion is also unverified; manual acceptance alone cannot prove it.

Real-service registry is still empty. The local DKIM prototype is development-only
and does not attest direct delivery or exclude copied-message replay. Slack is
an exercised but rejected candidate for the numeric-only pilot, with confirmed mail
arrival, a genuine split-input challenge and owner-confirmed manual acceptance;
it is not a supported autofill service.
