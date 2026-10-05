import {
  connectionManifest,
  configuredGmail,
  gmailConfig,
} from '../apps/extension/gmail/config';
import coreGmail from '../configuration/core-1-gmail.json';
import { accountConfig } from '../apps/extension/account/config';
import domainAuth from '../configuration/domain-auth.json';
import { convexProbeOrigin } from '../apps/extension/account/probe';
import { configuredAccount } from '../apps/extension/account/config';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production extension permission boundary', () => {
  it('keeps the distributable artifact below the reviewed 25 MiB budget', () => {
    const root =
      process.env.OTPGuard_ARTIFACT ?? 'apps/extension/build/chrome-mv3-prod';
    const bytes = readdirSync(root, { recursive: true }).reduce(
      (total, file) => {
        const stat = statSync(`${root}/${String(file)}`);
        return total + (stat.isFile() ? stat.size : 0);
      },
      0,
    );
    expect(bytes).toBeLessThan(25 * 1024 * 1024);
  });
  it('ships MV3 popup and worker without site access or content injection', () => {
    const manifest = JSON.parse(
      readFileSync(
        `${process.env.OTPGuard_ARTIFACT ?? 'apps/extension/build/chrome-mv3-prod'}/manifest.json`,
        'utf8',
      ),
    );
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.background.service_worker).toBeTruthy();
    const exported = !!process.env.OTPGuard_ARTIFACT;
    const account = exported
      ? accountConfig({
          key:
            'pk_live_' +
            Buffer.from(
              new URL(domainAuth.frontendApi).hostname + '$',
            ).toString('base64'),
          syncHost: domainAuth.syncHost,
          frontendApi: domainAuth.frontendApi,
          webOrigin: domainAuth.webOrigin,
        })
      : configuredAccount();
    const gmail = exported
      ? gmailConfig({
          clientId: coreGmail.clientId,
          key: domainAuth.extensionPublicKey,
          extensionId: coreGmail.extensionId,
        })
      : configuredGmail();
    const expected = connectionManifest(account, gmail);
    const probeOrigin = convexProbeOrigin(
      exported
        ? 'https://grand-buffalo-545.convex.cloud'
        : process.env.PLASMO_PUBLIC_AUTH_CONVEX_ORIGIN,
    );
    if (probeOrigin) {
      expected.host_permissions.push(probeOrigin + '/*');
      expected.content_security_policy.extension_pages =
        expected.content_security_policy.extension_pages.replace(
          /;$/,
          ' ' + probeOrigin + ';',
        );
    }
    expect(manifest.permissions ?? []).toEqual([
      ...expected.permissions,
      'scripting',
      'webNavigation',
    ]);
    expect(manifest.optional_host_permissions).toEqual([
      'https://www.canva.com/*',
    ]);
    expected.host_permissions.push('https://dns.google/*');
    expected.content_security_policy.extension_pages =
      expected.content_security_policy.extension_pages
        .replace("connect-src 'none'", 'connect-src')
        .replace(/;$/, ' https://dns.google;');
    expect(manifest.host_permissions ?? []).toEqual(expected.host_permissions);
    expect(manifest.content_security_policy).toEqual(
      expected.content_security_policy,
    );
    if (account) expect(manifest.minimum_chrome_version).toBe('127');
    if (gmail) {
      expect(manifest.oauth2).toEqual(expected.oauth2);
      expect(manifest.key).toEqual(
        account ? domainAuth.extensionPublicKey : expected.key,
      );
      expect(manifest.minimum_chrome_version).toBe('127');
    } else {
      expect(manifest.oauth2).toBeUndefined();
      if (account) expect(manifest.key).toBe(domainAuth.extensionPublicKey);
      else expect(manifest.key).toBeUndefined();
    }
    expect(manifest.content_scripts ?? []).toEqual([]);
    expect(manifest.web_accessible_resources ?? []).toEqual([]);
    expect(manifest.externally_connectable).toBeUndefined();
  });
});

// Check generated artifacts rather than relying solely on source import discipline.
describe('fixture isolation', () => {
  for (const directory of [
    process.env.OTPGuard_ARTIFACT ?? 'apps/extension/build/chrome-mv3-prod',
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
        expect(source).not.toContain('Synthetic Lantern');
        expect(source).not.toContain('003719');
        expect(source).not.toContain('008417');
        expect(source).not.toContain('development-fabricated');
        expect(source).not.toContain('development-mailbox');
        expect(source).not.toContain('lantern.example');
        expect(source).not.toContain('pipeline/safe');
      }
    });
  }
  it('registers only the exact reviewed optional Canva origin dynamically', () => {
    const source = readFileSync('apps/extension/pipeline/worker.ts', 'utf8');
    expect(source).toContain('chrome.permissions.contains');
    expect(source).toContain('allFrames: false');
  });
});
