import { createHash, createPublicKey } from 'node:crypto';
import {
  gmailConfig,
  connectionManifest,
} from '../apps/extension/gmail/config';
import { readFile, writeFile, rm, mkdir, copyFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import domainAuth from '../configuration/domain-auth.json';
import { accountConfig } from '../apps/extension/account/config';
// The builder used PLASMO_PUBLIC_* names before. A build with old env files would
// silently come out unconfigured, so stop and say what to rename.
if (Object.keys(process.env).some((name) => name.startsWith('PLASMO_PUBLIC_')))
  throw new Error(
    'Rename PLASMO_PUBLIC_* variables to OTPGUARD_PUBLIC_* in your env files',
  );
const config = accountConfig({
  key: process.env.OTPGUARD_PUBLIC_CLERK_PUBLISHABLE_KEY,
  syncHost: process.env.OTPGUARD_PUBLIC_CLERK_SYNC_HOST,
  frontendApi: process.env.OTPGUARD_PUBLIC_CLERK_FRONTEND_API,
  webOrigin: process.env.OTPGUARD_PUBLIC_ACCOUNT_WEB_ORIGIN,
});
const gmail = gmailConfig({
  clientId: process.env.OTPGUARD_PUBLIC_GOOGLE_CLIENT_ID,
  key: process.env.OTPGUARD_PUBLIC_EXTENSION_KEY,
  extensionId: process.env.OTPGUARD_PUBLIC_EXTENSION_ID,
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
const finalized = {
  ...connectionManifest(config, gmail),
  ...(config
    ? { key: domainAuth.extensionPublicKey, minimum_chrome_version: '116' }
    : {}),
};
// Optional HTTPS site access; the extension popup confirms every Fill.
finalized.permissions.push('scripting', 'webNavigation');

const siteAccessManifest = {
  optional_host_permissions: ['https://*/*'],
  minimum_chrome_version: '127',
};
// The configured export passes a fresh absolute directory outside the checkout.
// The build deletes outdir first, so refuse relative overrides.
const outdirOverride = process.env.OTPGUARD_OUTDIR;
if (outdirOverride && !isAbsolute(outdirOverride))
  throw new Error('OTPGUARD_OUTDIR must be an absolute path');
const outdir = outdirOverride || 'build/chrome-mv3-prod';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
// Only these public configuration names reach the bundle. No generic env serialization.
const define: Record<string, string> = {
  'process.env.NODE_ENV': JSON.stringify('production'),
};
for (const name of [
  'OTPGUARD_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'OTPGUARD_PUBLIC_CLERK_SYNC_HOST',
  'OTPGUARD_PUBLIC_CLERK_FRONTEND_API',
  'OTPGUARD_PUBLIC_ACCOUNT_WEB_ORIGIN',
  'OTPGUARD_PUBLIC_GOOGLE_CLIENT_ID',
  'OTPGUARD_PUBLIC_EXTENSION_KEY',
  'OTPGUARD_PUBLIC_EXTENSION_ID',
])
  define[`process.env.${name}`] = JSON.stringify(process.env[name] ?? '');
const result = await Bun.build({
  entrypoints: ['background.ts', 'popup-entry.tsx', 'management-entry.tsx'],
  target: 'browser',
  loader: { '.ttf': 'file' },
  naming: { asset: '[name].[ext]' },
  format: 'esm',
  outdir,
  minify: true,
  splitting: false,
  define,
});
if (!result.success) throw new Error('Extension build failed');
const contentBuild = await Bun.build({
  entrypoints: ['content.ts'],
  target: 'browser',
  format: 'iife',
  outdir,
  minify: true,
  define,
});
if (!contentBuild.success) throw new Error('Content build failed');
await copyFile('assets/icon.png', `${outdir}/icon.png`);
await writeFile(
  `${outdir}/popup.html`,
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OTPGuard</title><link rel="stylesheet" href="popup-entry.css"></head><body><div id="root"></div><script type="module" src="popup-entry.js"></script></body></html>\n',
);
await writeFile(
  `${outdir}/management.html`,
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OTPGuard — Browser settings</title><link rel="stylesheet" href="management-entry.css"></head><body><div id="root"></div><script type="module" src="management-entry.js"></script></body></html>\n',
);
for (const name of ['BigShoulders-OFL.txt', 'InstrumentSans-OFL.txt'])
  await copyFile(`assets/fonts/${name}`, `${outdir}/${name}`);
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
      options_ui: { page: 'management.html', open_in_tab: true },
      background: { service_worker: 'background.js', type: 'module' },
      ...finalized,
      ...siteAccessManifest,
      ...(config
        ? {
            externally_connectable: {
              ids: [],
              matches: [config.webOrigin + '/*'],
            },
          }
        : {}),
    },
    null,
    2,
  ) + '\n',
);
