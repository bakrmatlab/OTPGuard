import { createHash, createPublicKey } from 'node:crypto';
import {
  gmailConfig,
  connectionManifest,
} from '../apps/extension/gmail/config';
import { readFile, writeFile, rm, mkdir, copyFile } from 'node:fs/promises';
import { convexProbeOrigin } from '../apps/extension/account/probe';
import domainAuth from '../configuration/domain-auth.json';
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
if (config && gmail && gmail.extensionId !== domainAuth.extensionId)
  throw new Error('Account and Gmail must use the same reviewed extension ID');
const probeOrigin = convexProbeOrigin(
  process.env.PLASMO_PUBLIC_AUTH_CONVEX_ORIGIN,
);
if (probeOrigin && !config)
  throw new Error('Account configuration required for auth probe');
const finalized = {
  ...connectionManifest(config, gmail),
  ...(config
    ? { key: domainAuth.extensionPublicKey, minimum_chrome_version: '116' }
    : {}),
};
if (probeOrigin) {
  finalized.host_permissions.push(probeOrigin + '/*');
  finalized.content_security_policy.extension_pages =
    finalized.content_security_policy.extension_pages.replace(
      /;$/,
      ' ' + probeOrigin + ';',
    );
}
// Explicit entries only: never infer content registration or copy SDK asset trees.
if ((await readFile('content.ts')).length !== 0)
  throw new Error('Production content registration requires a separate review');
const outdir = 'build/chrome-mv3-prod';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
// Preserve legacy public configuration names. No generic env serialization.
const define: Record<string, string> = {
  'process.env.NODE_ENV': JSON.stringify('production'),
};
for (const name of [
  'PLASMO_PUBLIC_AUTH_CONVEX_ORIGIN',
  'PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'PLASMO_PUBLIC_CLERK_SYNC_HOST',
  'PLASMO_PUBLIC_CLERK_FRONTEND_API',
  'PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN',
  'PLASMO_PUBLIC_GOOGLE_CLIENT_ID',
  'PLASMO_PUBLIC_EXTENSION_KEY',
  'PLASMO_PUBLIC_EXTENSION_ID',
])
  define[`process.env.${name}`] = JSON.stringify(process.env[name] ?? '');
const result = await Bun.build({
  entrypoints: ['background.ts', 'popup-entry.tsx'],
  target: 'browser',
  format: 'esm',
  outdir,
  minify: true,
  splitting: false,
  define,
});
if (!result.success) throw new Error('Extension build failed');
await copyFile('assets/icon.png', `${outdir}/icon.png`);
await writeFile(
  `${outdir}/popup.html`,
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OTPGuard</title><link rel="stylesheet" href="popup-entry.css"></head><body><div id="root"></div><script type="module" src="popup-entry.js"></script></body></html>\n',
);
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  `${outdir}/manifest.json`,
  JSON.stringify(
    {
      manifest_version: 3,
      name: metadata.displayName,
      version: metadata.version,
      description: metadata.description,
      icons: { '128': 'icon.png' },
      action: { default_popup: 'popup.html', default_icon: 'icon.png' },
      background: { service_worker: 'background.js', type: 'module' },
      ...finalized,
    },
    null,
    2,
  ) + '\n',
);
