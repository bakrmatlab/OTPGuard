# ADR0016: Domain-hosted website login with a shared Clerk session

October 4, 2026. Status: owner accepted the shared session model; implementation for
review, production and live acceptance unverified.

The native development experiment failed actual Chromium registration because Origin
and Authorization conflict (ADR0015). The owner purchased otpguard.net at Cloudflare,
selected Vercel hosting, and explicitly selected shared website/extension sign-in and
sign-out. Use Clerk's production Chrome extension SDK with Sync Host and standard
website SignIn/SignUp components. Do not port the custom native FAPI client.

The website selects the account; the extension reads the production Frontend API's
client cookie through the SDK. Both use the same selected session in this browser
profile. Ending that session in either client invalidates connected authority when
observed; fresh server session probes are required before operations and after awaits.
Cookie events and bounded local expiry cancel work; they do not promise instantaneous
remote revocation. Logout targets the selected session, not every device. Failed
logout keeps this worker locally suspended until successful retry; worker restart
must revalidate the provider session and can recover one that was never revoked.
Gmail disconnect, history deletion and account deletion remain separate actions.

Production keys and exact HTTPS origins retain the existing credential-URL gate.
The installed @clerk/chrome-extension 3.1.90 reads \_\_client at syncHost; use the
Frontend API origin https://clerk.otpguard.net, as illustrated by the dedicated Sync
Host guide. The general deployment guide's website-host wording is inconsistent;
actual cookie/network verification remains a prerequisite. SDK usage is not evidence
that the previous browser transport failure has been resolved in production.

A checked-in public SPKI establishes review extension ID
jfncecbkgdnhdppgpblbokkceflpmgif independently of Gmail. It is an unpacked-build
identity, not a store signing key or distribution approval; a future store ID needs
review and provider re-registration. The corresponding private key was discarded.

Convex receives only a fresh convex-template JWT in an Authorization header for a
bounded read-only subject query. Identity must match the freshly bound Clerk user
before and after the query; logout, expiry, replacement and late replies refuse
acceptance. No development issuer opt-in, sync activation or Gmail activation is
ported. Domain ownership proves neither authentication nor trusted email senders.

Rejected alternatives: the failed custom native transport, URL-bearing development
SDK tokens, privileged session creation, header interception and independent client
sessions. The earlier experiment and browser-failure research remain historical
records, with no experiment source or build entry points in this branch.

Evidence and prerequisites: [domain auth plan](../domain-auth.md).
