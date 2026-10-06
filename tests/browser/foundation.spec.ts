import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('web entry points expose the approved UI without configured accounts', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3100');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Find the code.Choose Fill.',
  );
  await expect(
    page.getByRole('link', { name: 'Install for Chrome' }),
  ).toHaveAttribute('href', '/setup');
  await expect(page.locator('#demo-code')).toHaveValue('');
  await page.goto('http://127.0.0.1:3100/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Browser settings', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Account authentication is unconfigured.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sign in to connect this browser' }),
  ).toBeVisible();
  for (const [route, title] of [
    ['sign-in', 'OTPGuard account sign-in'],
    ['sign-up', 'Create your OTPGuard account'],
  ] as const) {
    await page.goto('http://127.0.0.1:3100/' + route);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(
      page.getByText('Account authentication is unconfigured.'),
    ).toBeVisible();
    await expect(page.locator('input')).toHaveCount(0);
  }
});

test('unpacked extension worker, popup and management load without page access', async () => {
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
    await popup.setViewportSize({ width: 380, height: 600 });
    const errors: string[] = [];
    popup.on('pageerror', (error) => errors.push(error.name));
    await popup.goto(`chrome-extension://${id}/management.html`);
    await expect(
      popup.getByRole('heading', { name: 'Browser settings', exact: true }),
    ).toBeVisible();
    await expect(
      popup.getByText('Account authentication is unconfigured.'),
    ).toBeVisible();
    await expect(
      popup
        .getByText('Gmail connection is unconfigured.', { exact: false })
        .first(),
    ).toBeVisible();
    expect(
      await worker.evaluate(
        () => chrome.runtime.getManifest().content_scripts ?? [],
      ),
    ).toEqual([]);
    await expect(
      popup.getByText('Cloud history and settings sync are unavailable.', {
        exact: false,
      }),
    ).toBeVisible();
    const automatic = popup.getByRole('checkbox', {
      name: /Find codes automatically/,
    });
    await expect(automatic).toBeEnabled();
    await expect(automatic).toBeChecked();
    await automatic.click();
    await expect(automatic).not.toBeChecked();
    await automatic.click();
    await expect(automatic).toBeChecked();
    await expect(automatic).toBeEnabled();
    await popup.reload();
    await expect(automatic).toBeChecked();
    await automatic.click();
    await expect(automatic).not.toBeChecked();
    await expect(automatic).toBeEnabled();
    await popup
      .getByRole('textbox', { name: 'HTTPS origin to block' })
      .fill('https://site.fixture.invalid/login?synthetic=1');
    await expect(
      popup.getByRole('button', { name: 'Add site' }),
    ).toBeDisabled();
    await popup
      .getByRole('textbox', { name: 'HTTPS origin to block' })
      .fill('https://site.fixture.invalid');
    await popup.getByRole('button', { name: 'Add site' }).click();
    await expect(
      popup.getByRole('button', {
        name: 'Remove local block for https://site.fixture.invalid',
      }),
    ).toBeVisible();
    await popup.reload();
    await popup
      .getByRole('button', {
        name: 'Remove local block for https://site.fixture.invalid',
      })
      .click();
    await expect(
      popup.getByRole('button', {
        name: 'Remove local block for https://site.fixture.invalid',
      }),
    ).toHaveCount(0);
    await expect(popup.getByText('0 local activity records.')).toBeVisible();
    const event = {
      serviceId: null,
      action: 'FILL',
      result: 'FILLED',
      reason: 'none',
      time: Date.now(),
      installationId: '11111111-1111-4111-8111-111111111111',
    };
    // Fabricated closed record in isolated Chromium only; no real mail or page capture.
    await worker.evaluate(async (event) => {
      await chrome.storage.local.set({
        'otpguard.activity.v1': { version: 1, events: [event] },
      });
    }, event);
    await popup.reload();
    await expect(popup.getByText('1 local activity records.')).toBeVisible();
    await expect(
      popup.getByText('Code inserted (login acceptance unknown)', {
        exact: false,
      }),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Export local history' }).click();
    await expect(
      popup.getByRole('textbox', { name: 'Local history JSON' }),
    ).toHaveValue(JSON.stringify({ version: 1, events: [event] }));
    await popup.getByRole('button', { name: 'Delete local history' }).click();
    await expect(popup.getByText('0 local activity records.')).toBeVisible();
    await expect(
      popup.getByRole('textbox', { name: 'Local history JSON' }),
    ).toHaveCount(0);
    await popup.reload();
    await expect(popup.getByText('0 local activity records.')).toBeVisible();
    await expect(
      popup.getByText('Cloud history and settings sync are unavailable.', {
        exact: false,
      }),
    ).toBeVisible();
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3100');
    await expect(page.locator('input')).toHaveCount(1);
    await expect(page.locator('#demo-code')).toHaveValue('');
    expect(
      await worker.evaluate(
        () => chrome.runtime.getManifest().host_permissions ?? [],
      ),
    ).toEqual([]);
    await expect(
      popup.getByRole('button', { name: 'Fill', exact: true }),
    ).toHaveCount(0);
    await expect(
      popup.getByRole('button', { name: 'Enable on websites' }),
    ).toBeEnabled();
    await automatic.focus();
    await expect(automatic).toBeFocused();
    await popup.keyboard.press('Space');
    await expect(automatic).toBeChecked();
    await expect(automatic).toBeEnabled();
    await expect(automatic).toBeFocused();
    await popup.keyboard.press('Space');
    await expect(automatic).not.toBeChecked();

    expect(
      await popup.locator('body').evaluate((body) => body.scrollWidth <= 380),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});
