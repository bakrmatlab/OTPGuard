# Dashboard connection repair — October 6, 2026

Owner reported Setup complete reverting to Connect this browser, with repeated
checks refused. Reproduced in the actual worker listener: browser sender URL stayed
`/dashboard`, while the same document's live frame URL became `/dashboard#settings`.
Exact URL-string comparison refused status after dashboard section navigation.

Require the same browser document ID and validate both sender URL and current frame
URL through the exact production dashboard predicate. Hash navigation within that
same dashboard document does not change management authority. Other origins,
paths, query strings, credentials and document replacements remain rejected. Fresh
shared-account/session checks and queued mutation checks are unchanged. No Fill,
retrieval or credentials are available through this metadata-only management bridge.

Dashboard remembers only that this session previously connected, in component
memory. Failed verification still clears all metadata and disables management;
it now says Connection needs checking and offers Check connection again instead
of claiming setup was removed. Session change remounts clear this marker.

Reproduction: `bun run test -- tests/website-management-worker.test.ts` failed with
REFUSED instead of CONNECTED before the fix. Worker/protocol tests passed after the
fix, including current-route/origin/query and replaced-document negatives.
Full isolated checks and both builds pass; live owner Chrome remains unverified
under no computer use. Changes are local for review and are not deployed.

Owner authorized deployment and updating the local extension build after review.
Final isolated validation passed 817 tests; both builds, types/lint/format and diff
checks passed. Release CI and production verification follow publication.
