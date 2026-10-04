import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/package-review.ts');
const names = [
  'background.js',
  'icon.png',
  'manifest.json',
  'popup-entry.css',
  'popup-entry.js',
  'popup.html',
];
const manifest = {
  manifest_version: 3,
  action: { default_popup: 'popup.html' },
  background: { service_worker: 'background.js', type: 'module' },
  permissions: ['storage'],
  host_permissions: [],
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'none'; connect-src 'none';",
  },
};

describe('credential-free review package boundary', () => {
  for (const [name, setup, reason] of [
    [
      'provider file',
      (root: string) => writeFileSync(join(root, '.env.local'), 'SYNTHETIC=1'),
      'provider-free',
    ],
    ['provider environment', () => {}, 'Provider configuration'],
    [
      'unexpected extension file',
      (root: string) =>
        writeFileSync(
          join(root, 'apps/extension/build/chrome-mv3-prod/extra.js'),
          '',
        ),
      'Unexpected extension artifact',
    ],
    [
      'configured manifest',
      (root: string) =>
        writeFileSync(
          join(root, 'apps/extension/build/chrome-mv3-prod/manifest.json'),
          JSON.stringify({ ...manifest, oauth2: { client_id: 'synthetic' } }),
        ),
      'unconfigured boundary',
    ],
    [
      'traced env file',
      (root: string) =>
        writeFileSync(
          join(root, 'apps/web/.next/standalone/.env.production'),
          'SYNTHETIC=1',
        ),
      'Sensitive file',
    ],
    [
      'external dependency link',
      (root: string) => {
        const outside = join(root, 'outside.txt');
        writeFileSync(outside, 'synthetic');
        symlinkSync(outside, join(root, 'apps/web/.next/standalone/escape'));
      },
      'symlink must remain inside',
    ],
    [
      'traced provider key',
      (root: string) =>
        writeFileSync(
          join(root, 'apps/web/.next/standalone/key.json'),
          JSON.stringify({ key: 'sk_test_syntheticnotarealkey' }),
        ),
      'Provider key material',
    ],
  ] as const) {
    it(`refuses ${name} before creating archives`, () => {
      const root = mkdtempSync(join(tmpdir(), 'otpguard-package-test-'));
      try {
        const extension = join(root, 'apps/extension/build/chrome-mv3-prod');
        mkdirSync(extension, { recursive: true });
        mkdirSync(join(root, 'apps/web/.next/standalone'), { recursive: true });
        mkdirSync(join(root, 'apps/web/.next/static'), { recursive: true });
        for (const file of names) writeFileSync(join(extension, file), '');
        writeFileSync(
          join(extension, 'manifest.json'),
          JSON.stringify(manifest),
        );
        setup(root);
        const env = { ...process.env };
        for (const key of Object.keys(env))
          if (/^(?:PLASMO_PUBLIC_|NEXT_PUBLIC_CLERK_|CLERK_|CONVEX_)/.test(key))
            delete env[key];
        if (name === 'provider environment')
          env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID = 'synthetic';
        const result = spawnSync('bun', [script], {
          cwd: root,
          env,
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(reason);
        expect(existsSync(join(root, 'dist/review/extension.zip'))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});
