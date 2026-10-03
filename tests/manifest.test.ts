import { readFileSync } from 'node:fs';
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
