import type { AuthConfig } from 'convex/server';

export function authProviders(
  issuer?: string,
  profile?: string,
  deployment?: string,
): AuthConfig {
  if (!issuer) {
    if (profile) throw new Error('Development issuer required');
    return { providers: [] };
  }
  const url = new URL(issuer);
  if (
    url.protocol !== 'https:' ||
    url.origin !== issuer ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname.includes('.') ||
    url.hostname === 'localhost'
  )
    throw new Error('Exact Clerk issuer origin required');
  if (profile) {
    if (
      profile !== 'native-development' ||
      deployment !== 'https://academic-grouse-256.convex.cloud' ||
      !/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(url.hostname)
    )
      throw new Error('Isolated native development deployment required');
  } else if (url.hostname.endsWith('.clerk.accounts.dev')) {
    throw new Error('Production Clerk issuer origin required');
  }
  return { providers: [{ domain: issuer, applicationID: 'convex' }] };
}
