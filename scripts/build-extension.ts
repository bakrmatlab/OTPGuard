import { createHash, createPublicKey } from 'node:crypto';
import {
  gmailConfig,
  connectionManifest,
} from '../apps/extension/gmail/config';
import { readFile, writeFile } from 'node:fs/promises';
import { accountConfig } from '../apps/extension/account/config';
const config = accountConfig({
  key: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  syncHost: process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST,
  frontendApi: process.env.PLASMO_PUBLIC_CLERK_FRONTEND_API,
  webOrigin: process.env.PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN,
});
const gmail = gmailConfig({
  clientId: process.env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID,
  key: process.env.PLASMO_PUBLIC_EXTENSION_KEY,
  extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID,
});
if (gmail) {
  const der = Buffer.from(gmail.key, 'base64');
  createPublicKey({ key: der, format: 'der', type: 'spki' });
  const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
    .map((char) => String.fromCharCode(97 + parseInt(char, 16)))
    .join('');
  if (id !== gmail.extensionId)
    throw new Error('Manifest key does not match registered extension ID');
}
const finalized = connectionManifest(config, gmail);
const child = Bun.spawn(['bun', 'x', '--no-install', 'plasmo', 'build'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
if ((await child.exited) !== 0) throw new Error('Plasmo build failed');
const path = 'build/chrome-mv3-prod/manifest.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
if (
  (manifest.content_scripts ?? []).length ||
  (manifest.web_accessible_resources ?? []).length ||
  manifest.externally_connectable
)
  throw new Error('Unexpected extension page access');
await writeFile(
  path,
  JSON.stringify({ ...manifest, ...finalized }, null, 2) + '\n',
);
