import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production extension permission boundary', () => {
  it('ships MV3 popup and worker without site access or content injection', () => {
    const manifest = JSON.parse(
      readFileSync(
        'apps/extension/build/chrome-mv3-prod/manifest.json',
        'utf8',
      ),
    );
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.background.service_worker).toBeTruthy();
    expect(manifest.permissions ?? []).toEqual([]);
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.content_scripts ?? []).toEqual([]);
    expect(manifest.web_accessible_resources ?? []).toEqual([]);
    expect(manifest.externally_connectable).toBeUndefined();
  });
});

// Check generated artifacts rather than relying solely on source import discipline.
describe('fixture isolation', () => {
  for (const directory of [
    'apps/extension/build/chrome-mv3-prod',
    'apps/web/.next/static',
  ]) {
    it(`excludes local fixture adapters from ${directory}`, () => {
      for (const file of readdirSync(directory, { recursive: true })) {
        if (typeof file !== 'string' || !/\.(js|html|json)$/.test(file))
          continue;
        const source = readFileSync(`${directory}/${file}`, 'utf8');
        expect(source).not.toContain('Synthetic detection fixtures');
        expect(source).not.toContain('Replace single field');
        expect(source).not.toContain('127.0.0.1:3001');
        expect(source).not.toContain('/harness.js');
        expect(source).not.toContain('Synthetic insertion fixtures');
        expect(source).not.toContain('Fill synthetic fixture');
        expect(source).not.toContain('042681');
        expect(source).not.toContain('/insertion.js');
      }
    });
  }
  it('keeps the production content entry deliberately empty', () => {
    expect(readFileSync('apps/extension/content.ts', 'utf8')).toBe('');
  });
});
