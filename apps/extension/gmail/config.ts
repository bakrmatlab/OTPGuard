import { accountManifest, type AccountConfig } from '../account/config';
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export interface GmailConfig {
  clientId: string;
  key: string;
  extensionId: string;
}
export function gmailConfig(values: {
  clientId?: string | undefined;
  key?: string | undefined;
  extensionId?: string | undefined;
}): GmailConfig | null {
  if (!values.clientId && !values.key && !values.extensionId) return null;
  if (
    !values.clientId ||
    !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(values.clientId) ||
    !values.key ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(values.key) ||
    !values.extensionId ||
    !/^[a-p]{32}$/.test(values.extensionId)
  )
    throw new Error(
      'Complete Gmail client, public manifest key and registered extension ID required',
    );
  return {
    clientId: values.clientId,
    key: values.key,
    extensionId: values.extensionId,
  };
}
export function configuredGmail() {
  try {
    return gmailConfig({
      clientId: process.env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID,
      key: process.env.PLASMO_PUBLIC_EXTENSION_KEY,
      extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID,
    });
  } catch {
    return null;
  }
}
export function gmailManifest(config: GmailConfig | null) {
  return config
    ? {
        key: config.key,
        oauth2: { client_id: config.clientId, scopes: [GMAIL_SCOPE] },
        minimum_chrome_version: '106',
      }
    : {};
}

export function connectionManifest(
  account: AccountConfig | null,
  gmail: GmailConfig | null,
) {
  const base = accountManifest(account);
  return {
    ...base,
    ...gmailManifest(gmail),
    permissions: [...base.permissions, ...(gmail ? ['identity'] : [])],
    host_permissions: [
      ...base.host_permissions,
      ...(gmail
        ? [
            'https://gmail.googleapis.com/*',
            'https://oauth2.googleapis.com/revoke',
          ]
        : []),
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; connect-src " +
        ([
          ...(account ? [account.frontendApi] : []),
          ...(gmail
            ? ['https://gmail.googleapis.com', 'https://oauth2.googleapis.com']
            : []),
        ].join(' ') || "'none'") +
        ';',
    },
  };
}
