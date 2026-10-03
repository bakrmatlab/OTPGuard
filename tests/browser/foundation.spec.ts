import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('web entry point explains unavailable capabilities', async ({ page }) => {
  await page.goto('http://127.0.0.1:3100');
  await expect(page.getByRole('heading', { name: 'OTPGuard' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'Gmail connection and autofill are not yet supported.',
  );
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('unpacked extension worker and popup load without page access', async () => {
  const extension = resolve('apps/extension/build/chrome-mv3-prod');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(
      popup.getByRole('heading', { name: 'OTPGuard' }),
    ).toBeVisible();
    await expect(popup.getByRole('status')).toHaveText(
      'Gmail connection and autofill are not yet supported.',
    );
    expect(
      await worker.evaluate(
        () => chrome.runtime.getManifest().content_scripts ?? [],
      ),
    ).toEqual([]);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3100');
    await expect(page.locator('input')).toHaveCount(0);
    expect(
      await worker.evaluate(
        () => chrome.runtime.getManifest().host_permissions ?? [],
      ),
    ).toEqual([]);
  } finally {
    await context.close();
  }
});
