import { createHash, createPublicKey } from 'node:crypto';
import { expect, it } from 'vitest';
import domainAuth from '../configuration/domain-auth.json';
import allowed from '../configuration/clerk-production-instance.json';
import {
  accountConfig,
  accountManifest,
} from '../apps/extension/account/config';
it('binds a valid stable public key to the exact reviewed extension origin without Gmail access', () => {
  const der = Buffer.from(domainAuth.extensionPublicKey, 'base64');
  expect(
    createPublicKey({ key: der, format: 'der', type: 'spki' })
      .asymmetricKeyType,
  ).toBe('rsa');
  const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
    .map((char) => String.fromCharCode(97 + parseInt(char, 16)))
    .join('');
  expect(id).toBe(domainAuth.extensionId);
  expect(allowed.allowed_origins).toEqual(['chrome-extension://' + id]);
  const config = accountConfig({
    key: 'pk_live_' + btoa('clerk.otpguard.net$'),
    ...domainAuth,
  });
  expect(accountManifest(config).host_permissions).toEqual([
    'https://clerk.otpguard.net/*',
  ]);
  expect(accountManifest(config).permissions).toEqual(['cookies', 'storage']);
});
