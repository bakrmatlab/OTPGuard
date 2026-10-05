import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import type { verifyDkimPrototype } from '../../development/dkim/verify';
import { fixture, policy, record } from '../fixtures/email/dkim';
const source = transpileModule(
  readFileSync('packages/security/dkim.ts', 'utf8'),
  {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
  },
).outputText;
test('Web Crypto authenticates synthetic content in Chromium and refuses tampering', async ({
  page,
}) => {
  await page.route('https://dkim.example/**', (route) =>
    route.fulfill({
      body: '<!doctype html><title>Synthetic DKIM test</title>',
      contentType: 'text/html',
    }),
  );
  await page.goto('https://dkim.example/');
  const result = await page.evaluate(
    async ({ source, raw, policy, record }) => {
      const exports: { verifyDkimPrototype?: typeof verifyDkimPrototype } = {};
      new Function(
        'exports',
        source.replace(/verifyDkimContent/g, 'verifyDkimPrototype'),
      )(exports);
      if (!exports.verifyDkimPrototype) throw new Error('Missing prototype');
      const verify = exports.verifyDkimPrototype;
      const resolveKey = async () => [record];
      const input = Uint8Array.from(raw);
      const success = await verify(input, policy, resolveKey);
      const replay = await verify(input.slice(), policy, resolveKey);
      input[input.length - 4] = 56;
      const changed = await verify(input, policy, resolveKey);
      return { success, replay, changed, secure: isSecureContext };
    },
    { source, raw: [...fixture().raw], policy, record },
  );
  expect(result.secure).toBe(true);
  expect(result.success).toEqual({
    status: 'content-authenticated',
    receipt: 'unverified',
    replay: 'unresolved',
  });
  expect(result.replay).toEqual(result.success);
  expect(result.changed.status).toBe('refused');
});
