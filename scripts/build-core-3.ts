import { cp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, basename, dirname } from 'node:path';
import auth from '../configuration/domain-auth.json';
import gmail from '../configuration/core-1-gmail.json';

// Export current source into a new directory: never overwrite owner builds or env files.
const destination = process.argv[2];
if (!destination || !destination.startsWith('/'))
  throw new Error('Provide a new absolute isolated export directory');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(destination);
if (out === root || out.startsWith(root + '/'))
  throw new Error('Export must be outside the owner checkout');
await mkdir(out); // Existing exports are refused, including previous owner artifacts.
for (const path of ['apps/extension', 'packages', 'scripts', 'configuration']) {
  await cp(resolve(root, path), resolve(out, path), {
    recursive: true,
    filter: (source) =>
      !['node_modules', 'build', '.plasmo'].includes(basename(source)) &&
      !basename(source).startsWith('.env'),
  });
}
await cp(resolve(root, 'package.json'), resolve(out, 'package.json'));
await symlink(resolve(root, 'node_modules'), resolve(out, 'node_modules'));
await symlink(
  resolve(root, 'apps/extension/node_modules'),
  resolve(out, 'apps/extension/node_modules'),
);
const env = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY:
    'pk_live_' +
    Buffer.from(new URL(auth.frontendApi).hostname + '$').toString('base64'),
  PLASMO_PUBLIC_CLERK_SYNC_HOST: auth.syncHost,
  PLASMO_PUBLIC_CLERK_FRONTEND_API: auth.frontendApi,
  PLASMO_PUBLIC_ACCOUNT_WEB_ORIGIN: auth.webOrigin,
  PLASMO_PUBLIC_AUTH_CONVEX_ORIGIN: 'https://grand-buffalo-545.convex.cloud',
  PLASMO_PUBLIC_GOOGLE_CLIENT_ID: gmail.clientId,
  PLASMO_PUBLIC_EXTENSION_KEY: auth.extensionPublicKey,
  PLASMO_PUBLIC_EXTENSION_ID: gmail.extensionId,
};
if (gmail.extensionId !== auth.extensionId)
  throw new Error('Reviewed identities differ');
const result = spawnSync(
  process.execPath,
  ['../../scripts/build-extension.ts'],
  {
    cwd: resolve(out, 'apps/extension'),
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
      artifact: resolve(out, 'apps/extension/build/chrome-mv3-prod'),
      distribution: gmail.distribution,
      realRetrieval: true,
      realFill: 'user-clicked-pilot',
      cloudHistory: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Controlled Core 3 artifact: ' +
    resolve(out, 'apps/extension/build/chrome-mv3-prod'),
);
