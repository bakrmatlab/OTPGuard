import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('popup loading and storage errors fail closed without enabling unsupported actions', async () => {
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
    const popup = await context.newPage();
    const errors: string[] = [];
    popup.on('pageerror', (error) => errors.push(error.name));
    await popup.addInitScript(() => {
      chrome.runtime.sendMessage = (() =>
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Synthetic worker unavailable')),
            800,
          ),
        )) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(popup.getByText('Checking Gmail connection…')).toBeVisible();
    await expect(popup.getByRole('checkbox')).toBeDisabled();
    await expect(
      popup.getByText(
        'Local settings unavailable. Automatic fill stays disabled.',
      ),
    ).toBeVisible();
    await expect(popup.getByText('Local history unavailable.')).toBeVisible();
    await expect(
      popup.getByRole('button', { name: 'Export local history' }),
    ).toBeDisabled();
    await expect(
      popup.getByRole('button', { name: 'Delete local history' }),
    ).toBeEnabled();
    await popup.getByRole('button', { name: 'Delete local history' }).click();
    await expect(
      popup.getByRole('button', { name: 'Delete local history' }),
    ).toBeEnabled();
    await expect(
      popup.getByRole('button', { name: 'Fill verified code' }),
    ).toBeDisabled();
    await expect(
      popup.getByRole('button', { name: 'Retry retrieval' }),
    ).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
