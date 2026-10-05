import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('web entry point explains unavailable capabilities', async ({ page }) => {
  await page.goto('http://127.0.0.1:3100');
  await expect(
    page.getByRole('heading', { name: 'Email codes, with less friction.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Get started', exact: true }),
  ).toHaveAttribute('href', '/sign-up');
  await page.goto('http://127.0.0.1:3100/dashboard');
  await expect(
    page.getByRole('heading', {
      name: 'Overview',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'The extension checks email codes locally and fills only after your click.',
      {
        exact: false,
      },
    ),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Manage account', exact: true }).click();
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
  await page.goto('http://127.0.0.1:3100/sign-up');
  await expect(
    page.getByRole('heading', { name: 'Create your OTPGuard account' }),
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
    await popup.setViewportSize({ width: 380, height: 600 });
    const errors: string[] = [];
    popup.on('pageerror', (error) => errors.push(error.name));
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(
      popup.getByRole('heading', { name: 'OTPGuard', exact: true }),
    ).toBeVisible();
    await expect(popup.getByRole('status')).toContainText(
      'Open an email-code challenge',
    );
    await popup.evaluate(() => {
      for (const panel of document.querySelectorAll<HTMLDetailsElement>(
        'details.panel, details.management',
      ))
        panel.open = true;
    });
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
      popup.getByText('Cloud settings sync is unconfigured.', { exact: false }),
    ).toBeVisible();
    const automatic = popup.getByRole('checkbox', {
      name: 'Automatically find codes and show the Fill prompt',
    });
    await expect(automatic).toBeEnabled();
    await expect(automatic).not.toBeChecked();
    await automatic.click();
    await expect(automatic).toBeChecked();
    await expect(automatic).toBeEnabled();
    await popup.reload();
    await popup.evaluate(() => {
      for (const panel of document.querySelectorAll<HTMLDetailsElement>(
        'details.panel, details.management',
      ))
        panel.open = true;
    });
    await expect(automatic).toBeChecked();
    await automatic.click();
    await expect(automatic).not.toBeChecked();
    await expect(automatic).toBeEnabled();
    await popup
      .getByRole('textbox', { name: 'HTTPS origin to block' })
      .fill('https://site.fixture.invalid/login?synthetic=1');
    await expect(
      popup.getByRole('button', { name: 'Block site locally' }),
    ).toBeDisabled();
    await popup
      .getByRole('textbox', { name: 'HTTPS origin to block' })
      .fill('https://site.fixture.invalid');
    await popup.getByRole('button', { name: 'Block site locally' }).click();
    await expect(
      popup.getByRole('button', {
        name: 'Remove local block for https://site.fixture.invalid',
      }),
    ).toBeVisible();
    await popup.reload();
    await popup.evaluate(() => {
      for (const panel of document.querySelectorAll<HTMLDetailsElement>(
        'details.panel, details.management',
      ))
        panel.open = true;
    });
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
    await popup.evaluate(() => {
      for (const panel of document.querySelectorAll<HTMLDetailsElement>(
        'details.panel, details.management',
      ))
        panel.open = true;
    });
    await expect(popup.getByText('1 local activity records.')).toBeVisible();
    await expect(
      popup.getByText('Input filled (login acceptance unknown)', {
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
    await popup.evaluate(() => {
      for (const panel of document.querySelectorAll<HTMLDetailsElement>(
        'details.panel, details.management',
      ))
        panel.open = true;
    });
    await expect(popup.getByText('0 local activity records.')).toBeVisible();
    await expect(
      popup.getByText('Cloud activity upload is disabled', { exact: false }),
    ).toBeVisible();
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3100');
    await expect(page.locator('input')).toHaveCount(0);
    expect(
      await worker.evaluate(
        () => chrome.runtime.getManifest().host_permissions ?? [],
      ),
    ).toEqual([]);
    await expect(popup.getByRole('button', { name: 'Fill' })).toBeDisabled();
    await expect(
      popup.getByRole('button', { name: 'Find code / Retry' }),
    ).toBeEnabled();
    await expect(
      popup.getByRole('button', { name: 'Open dashboard' }),
    ).toBeDisabled();
    await expect(
      popup.getByRole('button', { name: 'Enable on websites' }).first(),
    ).toBeEnabled();
    await popup.getByText('How code matching works', { exact: true }).focus();
    await popup.keyboard.press('Enter');
    await expect(
      popup.getByText('Sender identity and the email-to-website relationship', {
        exact: false,
      }),
    ).toBeVisible();
    await automatic.focus();
    await expect(automatic).toBeFocused();
    await popup.keyboard.press('Space');
    await expect(automatic).toBeChecked();
    await expect(automatic).toBeEnabled();
    await expect(automatic).toBeFocused();
    await popup.keyboard.press('Space');
    await expect(automatic).not.toBeChecked();
    await expect(popup.getByText('No recorded fill action.')).toBeVisible();
    expect(
      await popup.locator('body').evaluate((body) => body.scrollWidth <= 380),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});
