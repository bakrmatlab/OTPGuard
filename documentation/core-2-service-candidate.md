# Core 2 service candidate: OpenAI email login verification

October 4, 2026. Investigation concluded with unresolved feasibility on `codex/core-2-real-mail-trust`,
based on Core 1 commit `965bee5`. This is a candidate dossier, not supported-service
registration or acceptance evidence.

The owner selected candidate investigation and confirmed an existing OpenAI account
can be tested with verification mail arriving in the connected Gmail mailbox. The
owner requests and enters any live code directly. No credentials, personal mail,
screenshots of mail, or live codes belong in this document or committed fixtures.

## First-party facts

[OpenAI login verification guidance](https://help.openai.com/en/articles/9889414-why-am-i-being-asked-to-verify-my-login)
describes six-digit email OTP verification during login, including a possible email
fallback from push approval. It names `noreply@tm.openai.com` and `otp@tm1.openai.com`.
These are candidate sender mappings, not authenticated identity evidence. The actual
flow depends on account and device setup; an email challenge is not guaranteed on
every login. The article does not specify a numeric lifetime, an exact email template,
DKIM signing domains/selectors, or the browser origin of every challenge page.

GitHub was also considered. Its
[new-device verification guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/verifying-new-devices-when-signing-in)
conditions email verification on an unrecognized device and an account without 2FA.
Do not disable 2FA to manufacture an email-code demonstration. OpenAI is the first
candidate to exercise because the owner confirmed an available account.

## Required local observations

- Owner reaches an actual email-code challenge; record exact HTTPS origin, field
  type/count/length and event requirements without recording account or code values.
- Inspect only the requested verification message locally. Establish MIME structure,
  subject/body template and candidate extraction equality; retain sanitized outcomes.
- Bind any authenticated evidence to the exact original bytes and parsed material.
  Replacing a code or identifier invalidates existing DKIM signatures. A sanitized
  fixture tests parsing; it cannot prove the original signature verification result.
- Test forged result headers, spoofed From, forwarded/imported messages and replay
  against a justified evidence boundary before adding a production service rule.

## Current implementation boundary

`packages/security/gmail.ts` always returns unknown sender and unverified receipt.
`supportedServices` is empty; production retrieval/fill stays disabled. Gmail headers,
fresh-looking `internalDate`, a documented sender address and a recognizable template
cannot change those decisions. Local cryptographic verification must be evaluated
separately from direct-delivery and replay guarantees.

Service origin, template, authentication mapping, freshness limit, actual message
extraction and live input/event behavior remain unverified. This dossier must not be
treated as a real sanitized fixture or a passed live test.

## Core 2 outcome

Fresh Chrome inspection on October 4 still shows the signed-in ChatGPT homepage
at `https://chatgpt.com/`, without an email-code challenge. No logout, credentials,
mail inspection or code request was performed in this chat. The prior login URL
redirect is session behavior, not a validated challenge origin or supported field.
First-party guidance was rechecked; template, signer and input acceptance remain
unverified. See [Core 2 acceptance](core-2-acceptance.md) and
[ADR0018](adr/0018-core-2-mail-trust-feasibility.md). Collecting one genuine
template would not repair the missing direct-receipt contract.
