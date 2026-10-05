import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

// Local credential-free review packages only. Never package a configured owner build.
for (const directory of ['.', 'apps/web', 'apps/extension'])
  if (
    (await readdir(directory)).some(
      (name) => name.startsWith('.env') && name !== '.env.example',
    )
  )
    throw new Error('Use a provider-free clone/export for review packaging');
if (
  Object.entries(process.env).some(
    ([name, value]) =>
      value &&
      /^(?:PLASMO_PUBLIC_|NEXT_PUBLIC_CLERK_|CLERK_|CONVEX_)/.test(name),
  )
)
  throw new Error('Provider configuration must be absent for review packaging');

const extension = 'apps/extension/build/chrome-mv3-prod';
const extensionFiles = [
  'background.js',
  'content.js',
  'icon.png',
  'manifest.json',
  'popup-entry.css',
  'popup-entry.js',
  'popup.html',
];
if (
  JSON.stringify((await readdir(extension)).sort()) !==
  JSON.stringify(extensionFiles)
)
  throw new Error('Unexpected extension artifact files');
const manifest = JSON.parse(
  await readFile(`${extension}/manifest.json`, 'utf8'),
);
if (
  manifest.manifest_version !== 3 ||
  manifest.action?.default_popup !== 'popup.html' ||
  manifest.background?.service_worker !== 'background.js' ||
  manifest.background?.type !== 'module' ||
  JSON.stringify(manifest.permissions) !==
    JSON.stringify(['storage', 'scripting', 'webNavigation']) ||
  JSON.stringify(manifest.host_permissions) !== JSON.stringify([]) ||
  JSON.stringify(manifest.optional_host_permissions) !==
    JSON.stringify(['https://*/*']) ||
  manifest.minimum_chrome_version !== '127' ||
  manifest.content_scripts ||
  manifest.web_accessible_resources ||
  manifest.externally_connectable ||
  manifest.oauth2 ||
  manifest.key ||
  manifest.content_security_policy?.extension_pages !==
    "script-src 'self'; object-src 'none'; connect-src 'none';"
)
  throw new Error(
    'Review extension must retain the default unconfigured boundary',
  );

const scratch = await realpath(
  await mkdtemp(join(tmpdir(), 'otpguard-review-package-')),
);
const output = resolve('dist/review');
try {
  const web = join(scratch, 'web');
  await cp('apps/web/.next/standalone', web, {
    recursive: true,
    verbatimSymlinks: true,
  });
  await cp('apps/web/.next/static', join(web, 'apps/web/.next/static'), {
    recursive: true,
  });
  // Reject provider files or private key material in traced dependencies/output.
  // This supplements the clean-build rule; it is not a general secret detector.
  const inspect = async (
    directory: string,
    root: string,
    allowLinks = false,
  ) => {
    for (const name of await readdir(directory)) {
      if (name.startsWith('.env') || name.endsWith('.pem'))
        throw new Error('Sensitive file found in review artifact');
      const path = join(directory, name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) {
        const target = await readlink(path);
        if (
          !allowLinks ||
          isAbsolute(target) ||
          !resolve(dirname(path), target).startsWith(root + sep) ||
          !(await realpath(path)).startsWith(root + sep)
        )
          throw new Error('Artifact symlink must remain inside the package');
        continue;
      }
      if (stat.isDirectory()) await inspect(path, root, allowLinks);
      else if (/\.(?:js|json|html|css|txt|map)$/.test(name)) {
        const text = await readFile(path, 'utf8');
        if (
          /(?:pk|sk)_(?:live|test)_[A-Za-z0-9]{12,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(
            text,
          )
        )
          throw new Error('Provider key material found in review artifact');
      }
    }
  };
  await inspect(extension, resolve(extension));
  await inspect(web, web, true);
  await mkdir(output, { recursive: true });
  const records = [];
  for (const [name, directory, files] of [
    ['extension.zip', resolve(extension), extensionFiles],
    ['web.zip', web, ['.']],
  ] as const) {
    const archive = join(scratch, name);
    execFileSync('zip', ['-q', '-r', '-y', archive, ...files], {
      cwd: directory,
      stdio: 'pipe',
    });
    const bytes = await readFile(archive);
    await writeFile(join(output, name), bytes);
    records.push({
      name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  let sourceCommit: string | null = null;
  let worktreeDirty: boolean | null = null;
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    worktreeDirty = !!execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  } catch {
    // Source exports have no Git provenance; never invent a clean revision.
  }
  await writeFile(
    join(output, 'provenance.json'),
    JSON.stringify(
      {
        purpose: 'unconfigured-local-review-only',
        packagingContext: {
          sourceCommit,
          worktreeDirty,
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
        },
        buildOrigin: 'not-attested; fresh same-platform builds required',
        webBuildId: (await readFile('apps/web/.next/BUILD_ID', 'utf8')).trim(),
        archives: records,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Created default extension/web review ZIPs and provenance in dist/review',
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
