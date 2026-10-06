# ADR0028 — Bounded complete generic retrieval

Status: local implementation for owner review, October 5, 2026.

## Problem and evidence

The generic transport rejected pagination and more than ten message IDs. Sequential
body reads could consume the search budget in a busy mailbox. Spam/trash were excluded,
so plausible competing messages there were invisible. A connected regression also
reproduced release when an unreadable newsletter-like message contained another code:
its subject and snippet were insufficient evidence to exclude its unseen body.
Padded transfer-encoding headers refused otherwise ordinary MIME alternatives.

## Decision

Generic retrieval enumerates every returned ID across at most five pages of twenty
entries, deduplicates IDs, and refuses more than fifty unique IDs. Enumeration must
finish before any body fetch. Opaque page tokens are bounded and passed only as a
pageToken parameter; repeated tokens, malformed responses and incomplete sets refuse.
Result-size estimates and provider ordering never establish completeness or selection.

Include spam/trash in this same time-only search. Do not add keyword, unread, inbox,
sender or page-derived filters. Request only IDs/page tokens in lists and
id/internalDate/raw in raw message responses. Four workers fetch the entire set,
keeping 512 KiB response and 256 KiB raw-MIME limits. Aggregate streamed JSON bytes
are capped at 8 MiB, including both listings. A cycle is bounded by thirty seconds,
inside the existing sixty-second search; ten-second request timeouts cover headers
and body reads. Failure aborts siblings and discards the partial set.

After a nonempty fetch, repeat the same complete bounded listing. A different ID set
refuses that cycle as a retryable network/inconsistency failure, permitting only the
existing bounded polling schedule. Each enumeration has a five-page cap, so at most
ten list calls and fifty body calls occur in a successful cycle. Empty listings return
to the existing polling loop. Cancellation detaches stalled operations; late fetch
responses are closed and cannot start another stage.

Eligible unreadable messages now make a cycle incomplete regardless of subject or
snippet. This supersedes ADR0023's decoder-failure newsletter exclusion. Readable
unrelated mail can still be excluded by parsing; existing receipt/recipient/length/
service heuristics remain unchanged. Generic MIME accepts surrounding whitespace on
transfer-encoding tokens after header unfolding. All text alternatives still contribute
to ambiguity; malformed bytes/unknown charsets refuse without fallback guessing.
The historical signed pilot keeps its ten-body/no-pagination/category/MIME contract.

## Alternatives and consequences

Keyword searches, only fetching the first/newest IDs, or trusting snippets could hide
competition. Unlimited retrieval would violate resource/privacy bounds. Choosing a
newest candidate would weaken ambiguity refusal. None is adopted.

More recent mail is read locally, including spam/trash, and the closing list adds
provider traffic. Conservative unreadable-mail refusal can reduce success in noisy
mailboxes. No permission, grant, persistence, logging, backend traffic or cloud sync is
added. Mail/code/token processing remains volatile; cleanup is best effort.

Two listings are not an atomic Gmail snapshot or proof of complete provider indexing.
Mail indexed after the closing listing or during confirmation can still be missed.
Late old mail inside a fresh receipt window and concurrent same-mailbox challenges
still lack reliable server transaction identity. Generic matches remain candidates;
fresh release authority, write-ahead replay refusal, required Fill and no submission
remain mandatory. Live coverage/success rates are unmeasured.

## Verification

See [rank-4 acceptance](../retrieval-mime-acceptance.md) for red/green regressions,
cap/time/resource tests, composed connected retrieval, browser/artifact validation
and exact unverified limits. Provider semantics are documented by
[Gmail messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list):
pageToken/nextPageToken support, spam/trash inclusion, and estimated result counts.
