export interface AccountConfig {
  publishableKey: string;
  syncHost: string;
  frontendApi: string;
  webOrigin: string;
}
const origin = (value: string) => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !url.hostname.includes('.') ||
    /^(?:\d+\.){3}\d+$/.test(url.hostname) ||
    url.hostname.includes(':') ||
    url.hostname.endsWith('.') ||
    url.hostname.endsWith('.localhost') ||
    url.hostname.endsWith('.local') ||
    url.hostname.includes('*')
  )
    throw new Error('Account hosts must be exact HTTPS origins');
  return url.origin;
};
/** No permissive defaults or development-cookie transport in production. */
export function accountConfig(values: {
  key?: string | undefined;
  syncHost?: string | undefined;
  frontendApi?: string | undefined;
  webOrigin?: string | undefined;
}): AccountConfig | null {
  if (
    !values.key &&
    !values.syncHost &&
    !values.frontendApi &&
    !values.webOrigin
  )
    return null;
  if (
    !values.key?.startsWith('pk_live_') ||
    !values.syncHost ||
    !values.frontendApi ||
    !values.webOrigin
  )
    throw new Error(
      'Complete production Clerk configuration required; test-key URL transport is unsupported',
    );
  const frontendApi = origin(values.frontendApi);
  const decoded = atob(values.key.slice(8));
  if (decoded !== new URL(frontendApi).hostname + '$')
    throw new Error('Clerk key and Frontend API must match');
  const syncHost = origin(values.syncHost);
  if (syncHost !== frontendApi)
    throw new Error(
      'Production sync host must be the Clerk Frontend API origin',
    );
  return {
    publishableKey: values.key,
    syncHost,
    frontendApi,
    webOrigin: origin(values.webOrigin),
  };
}
export function accountManifest(config: AccountConfig | null) {
  return {
    permissions: config ? ['cookies', 'storage'] : [],
    host_permissions: config ? [config.syncHost + '/*'] : [],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; connect-src " +
        (config ? config.frontendApi : "'none'") +
        ';',
    },
  };
}
export function configuredAccount() {
  try {
    return accountConfig({
      key: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      syncHost: process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST,
      frontendApi: process.env.PLASMO_PUBLIC_CLERK_FRONTEND_API,
      webOrigin: process.env.PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN,
    });
  } catch {
    return null;
  }
}
