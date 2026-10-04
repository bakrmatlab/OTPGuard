import { readFile, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { nativeOrigin } from '../development/native-auth/client';

// Explicit public configuration; never load/overwrite provider env files.
const clerk = nativeOrigin(process.env.OTPGUARD_NATIVE_CLERK_ORIGIN ?? '');
const convex = process.env.OTPGUARD_NATIVE_CONVEX_ORIGIN ?? '';
const url = new URL(convex);
if (
  url.origin !== convex ||
  url.protocol !== 'https:' ||
  url.port ||
  url.username ||
  url.password ||
  !/^[a-z0-9-]+\.convex\.cloud$/.test(url.hostname)
)
  throw new Error('Exact Convex origin required');
const outdir = 'build/native-auth-prototype';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
const result = await Bun.build({
  entrypoints: [
    'development/native-auth/worker.ts',
    'development/native-auth/page.ts',
  ],
  target: 'browser',
  format: 'esm',
  outdir,
  minify: true,
  define: {
    'process.env.OTPGUARD_NATIVE_CLERK_ORIGIN': JSON.stringify(clerk),
    'process.env.OTPGUARD_NATIVE_CONVEX_ORIGIN': JSON.stringify(convex),
  },
});
if (!result.success) throw new Error('Native prototype build failed');
await copyFile('development/native-auth/login.html', `${outdir}/login.html`);
await copyFile('development/native-auth/login.css', `${outdir}/login.css`);
const metadata = JSON.parse(
  await readFile('apps/extension/package.json', 'utf8'),
);
await writeFile(
  `${outdir}/manifest.json`,
  JSON.stringify(
    {
      manifest_version: 3,
      name: 'OTPGuard native auth development prototype',
      version: metadata.version,
      action: { default_title: 'Open development login' },
      background: { service_worker: 'worker.js', type: 'module' },
      host_permissions: [clerk + '/*', convex + '/*'],
      content_security_policy: {
        extension_pages: `script-src 'self'; object-src 'none'; connect-src ${clerk} ${convex};`,
      },
    },
    null,
    2,
  ) + '\n',
);
