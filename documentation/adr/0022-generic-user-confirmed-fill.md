# ADR0022 — Generic, user-confirmed email-code filling

Date: October 5, 2026. Owner-selected local implementation scope.

The owner selected generic OTP detection and recent-mail matching, no per-site
configuration, and a minimal “Code found” / Fill popup without sender/destination
labels. This explicitly replaces the reviewed-service-only release requirement for
this mode. It does not authorize publishing, merging, deployment or grant changes.

Production uses a separate CANDIDATE decision, never VERIFIED. Unknown sender identity
and an unproven email-to-website relationship are expected in this mode. A required
extension-owned Fill click authorizes the single candidate to the bound current page.
There is no automatic insertion, guessed trust mapping or remembered site association.
A matching time/format cannot prove the email belongs to that login. Spoofed recent
mail, intact-copy replay, imports and another login's sole plausible code remain risks.
The existing reviewed policy and DKIM implementation remain available separately.

Request broad optional `https://*/*` access once from an explicit setup button, with
the limitation explained before granting. Browser permission is required independently
of connected Gmail/Clerk authority. Register top-level detection only after that grant;
existing Canva-only or provider endpoint grants cannot enable the generic reader.
Permission revocation invalidates pending work. No HTTP, iframe or page-world support.

Search all recent Gmail messages in the 60-second lookback/current request window;
no page text, sender guess or email links become Gmail filters. Existing 20-ID/10-body,
size, retry, deadline, quota and cancellation caps remain. Truncation and malformed
unsupported mail refuse the cycle rather than hiding possible competing codes.
Normalized unrelated/non-code messages are ignored. Different plausible codes/messages
refuse; never choose the newest as a tie breaker. All generic requests share one service
bucket so competing websites cannot independently select the same mailbox candidate.

Use bounded raw MIME/plain text and inert HTML text extraction. Candidate-only
normalization supports bounded UTF-8/ASCII RFC 2047 B/Q encoded subjects; malformed
or unsupported words and unsafe controls still refuse. English explicit OTP
labels and numeric 4–8 digits are supported. Footer numbers need no trust meaning;
only contextually plausible codes are candidates. Plain/HTML alternatives contribute
jointly to ambiguity. Resources are never loaded or executed. Unknown input maxlength
is resolved from the candidate before prepare; releases still require exact length.

Preserve account/mailbox/document/origin/focus/field rechecks, local blocks, user values,
write-ahead message reservation, volatile approvals and no extension submission.
History records generic activity with null service ID, not arbitrary website names.
No new persistent mail, code, sender, mapping or token data. DNS queries/permission are
removed from the production generic path. Cloud transport remains inactive.

Tests and actual acceptance are reported in ../generic-fill-acceptance.md. Additional
website compatibility and all prior deferred live lifecycle/privacy cases remain
unverified. Public coverage or phishing-protection guarantees are not inferred.

Review correction: generic HTML extraction uses pinned standards-based entity decoding
after stripping markup. The original six-entity whitelist refused plain/HTML emails
that the prior plain-only decoder accepted. Invisible preheader padding becomes line
separators; code ambiguity and invalid numeric/control refusals remain. Connected
regressions also exclude footer years before code-sharing reminders from code matches.

Broad-format review revision: generic mode supports mixed MIME and ignores embedded
images/binary application attachments as inert resources. They never supply code
candidates; attached email remains unsupported. Subjectless mail and common legacy
charsets are accepted, and explicit code wording supports spaced/table-cell digits.
See generic-email-coverage.md. This changes generic-only format coverage, not sender
trust, ambiguity or click/lifecycle rules. A same-document SPA request is admitted
using the browser's live frame URL after document/origin checks because Chrome sender
metadata can retain the initial URL. All subsequent URL changes still invalidate.

Owner-requested reliability revision: ADR0023 narrows the complete plausible set using
bounded relevance/receipt/field/recipient/service hints, preserving unknown competition
and required click/lifecycle gates. It supersedes blanket refusal for explicitly ordinary
unreadable mail and introduces shared challenge/resend windows and retained acknowledgement.
