import type { AuthConfig } from 'convex/server';
// Unconfigured by default. No provider means no authenticated access.
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (issuer) {
  const url = new URL(issuer);
  if (
    url.protocol !== 'https:' ||
    url.origin !== issuer ||
    url.username ||
    url.password ||
    url.port ||
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.clerk.accounts.dev')
  )
    throw new Error('Production Clerk issuer origin required');
}
export default {
  providers: issuer ? [{ domain: issuer, applicationID: 'convex' }] : [],
} satisfies AuthConfig;
