import { readFile, writeFile } from 'node:fs/promises';
import {
  accountConfig,
  accountManifest,
} from '../apps/extension/account/config';
const config = accountConfig({
  key: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  syncHost: process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST,
  frontendApi: process.env.PLASMO_PUBLIC_CLERK_FRONTEND_API,
  webOrigin: process.env.PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN,
});
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
  JSON.stringify({ ...manifest, ...accountManifest(config) }, null, 2) + '\n',
);
