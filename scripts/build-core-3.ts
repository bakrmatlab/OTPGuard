import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import auth from '../configuration/domain-auth.json';
import gmail from '../configuration/core-1-gmail.json';

// Build into a new directory with committed public configuration only: never
// overwrite owner builds or read owner env files.
const destination = process.argv[2];
if (!destination || !destination.startsWith('/'))
  throw new Error('Provide a new absolute isolated export directory');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(destination);
if (out === root || out.startsWith(root + '/'))
  throw new Error('Export must be outside the owner checkout');
await mkdir(out); // Existing exports are refused, including previous owner artifacts.
const artifact = resolve(out, 'extension');
const env = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  OTPGUARD_OUTDIR: artifact,
  PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY:
    'pk_live_' +
    Buffer.from(new URL(auth.frontendApi).hostname + '$').toString('base64'),
  PLASMO_PUBLIC_CLERK_SYNC_HOST: auth.syncHost,
  PLASMO_PUBLIC_CLERK_FRONTEND_API: auth.frontendApi,
  PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN: auth.webOrigin,
  PLASMO_PUBLIC_GOOGLE_CLIENT_ID: gmail.clientId,
  PLASMO_PUBLIC_EXTENSION_KEY: auth.extensionPublicKey,
  PLASMO_PUBLIC_EXTENSION_ID: gmail.extensionId,
};
if (gmail.extensionId !== auth.extensionId)
  throw new Error('Reviewed identities differ');
const result = spawnSync(
  process.execPath,
  ['--no-env-file', '../../scripts/build-extension.ts'],
  {
    cwd: resolve(root, 'apps/extension'),
    env,
    stdio: 'inherit',
  },
);
if (result.error || result.status !== 0)
  throw new Error('Controlled extension build failed');
await writeFile(
  resolve(out, 'core-3-build.json'),
  JSON.stringify(
    {
      extensionId: gmail.extensionId,
      clientId: gmail.clientId,
      artifact,
      distribution: gmail.distribution,
      realRetrieval: true,
      realFill: 'user-clicked-pilot',
      cloudHistory: false,
    },
    null,
    2,
  ) + '\n',
);
console.log('Controlled Core 3 artifact: ' + artifact);
