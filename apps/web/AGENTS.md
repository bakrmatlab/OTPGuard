# Website

- otpguard.net: sign-in and sign-up (Clerk), guided setup, and a dashboard that
  manages the extension in this Chrome profile through `browser-transport.ts`.
- The dashboard receives metadata only, never codes or tokens. Do not add `fetch`,
  analytics or a backend that sends extension data anywhere.
- Deploys are manual on Vercel; merging does not update the live site.
- Unit tests: `apps/web/tests/`.
