import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('web entry point explains unavailable capabilities', async ({ page }) => {
  await page.goto('http://127.0.0.1:3100');
  await expect(
    page.getByRole('heading', { name: 'OTPGuard', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'Gmail connection and autofill are not yet supported.',
  );
  await expect(
    page.getByText('Account authentication is unconfigured.'),
  ).toBeVisible();
  await page.goto('http://127.0.0.1:3100/sign-in');
  await expect(
    page.getByRole('heading', { name: 'OTPGuard account sign-in' }),
  ).toBeVisible();
  await expect(
    page.getByText('Account authentication is unconfigured.'),
  ).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
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
    const external: string[] = [];
    context.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol !== 'chrome-extension:' && url.hostname !== '127.0.0.1')
        external.push(url.origin);
    });
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const popup = await context.newPage();
    const errors: string[] = [];
    popup.on('pageerror', (error) => errors.push(error.name));
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(
      popup.getByRole('heading', { name: 'OTPGuard', exact: true }),
    ).toBeVisible();
    await expect(popup.getByRole('status')).toHaveText(
      'Real Gmail retrieval and autofill remain disabled.',
    );
    await expect(
      popup.getByText('Account authentication is unconfigured.'),
    ).toBeVisible();
    await expect(
      popup.getByText('Gmail connection is unconfigured.', { exact: false }),
    ).toBeVisible();
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
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});
