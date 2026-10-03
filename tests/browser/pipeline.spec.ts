import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
const root = 'http://127.0.0.1:3001/pipeline';
test('installed development worker authorizes safe single/split and refuses mismatch/unknown/ambiguity', async () => {
  const extension = resolve('development/mock-extension/build');
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
    const page = await context.newPage();
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    for (const [fixture, state] of [
      ['safe', 'FILLED'],
      ['split', 'FILLED'],
      ['mismatch', 'MISMATCH'],
      ['unknown', 'UNKNOWN'],
      ['ambiguous', 'UNKNOWN'],
    ]) {
      await page.bringToFront();
      await page.goto(`${root}/${fixture}`);
      if (state === 'FILLED')
        await expect
          .poll(() =>
            page
              .locator('input')
              .evaluateAll((fields) =>
                fields
                  .map((field) => (field as HTMLInputElement).value)
                  .join(''),
              ),
          )
          .toBe('042681');
      else {
        await expect
          .poll(async () => {
            return popup.evaluate(async () => {
              const status = await chrome.runtime.sendMessage({
                type: 'status',
              });
              return status.state;
            });
          })
          .toBe(state);
        expect(await page.locator('input').inputValue()).toBe('');
      }
      await expect(page.locator('#submissions').first()).toHaveText('0');
    }
  } finally {
    await context.close();
  }
});
test('replacement, navigation, typing and background changes prevent release', async () => {
  const extension = resolve('development/mock-extension/build');
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
    const page = await context.newPage();
    for (const scenario of [
      'replace',
      'navigate',
      'history',
      'extra-group',
      'typing',
      'background',
    ]) {
      await page.bringToFront();
      await page.goto(`${root}/safe`);
      await expect.poll(() => worker.evaluate(() => true)).toBe(true);
      // Wait for detection/retrieval to start, still well before synthetic response.
      await page.waitForTimeout(200);
      if (scenario === 'replace')
        await page
          .locator('input')
          .evaluate((field) => field.replaceWith(field.cloneNode()));
      if (scenario === 'navigate') await page.goto(`${root}/unknown`);
      if (scenario === 'history')
        await page.evaluate(() =>
          history.pushState({}, '', '/pipeline/mismatch'),
        );
      if (scenario === 'extra-group')
        await page
          .locator('form')
          .evaluate((form) => document.body.append(form.cloneNode(true)));
      if (scenario === 'typing') await page.locator('input').fill('9');
      let other;
      if (scenario === 'background') {
        other = await context.newPage();
        await other.bringToFront();
      }
      await page.waitForTimeout(1000);
      expect(await page.locator('input').first().inputValue()).toBe(
        scenario === 'typing' ? '9' : '',
      );
      await expect(page.locator('#submissions').first()).toHaveText('0');
      await other?.close();
    }
  } finally {
    await context.close();
  }
});
test('terminating the worker during retrieval leaves the live document empty', async () => {
  const extension = resolve('development/mock-extension/build');
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
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const versions: {
      versionId: string;
      scriptURL: string;
      runningStatus: string;
    }[] = [];
    session.on('ServiceWorker.workerVersionUpdated', (event) =>
      versions.push(...event.versions),
    );
    await session.send('ServiceWorker.enable');
    await expect
      .poll(() =>
        versions.some(
          (version) =>
            version.scriptURL === worker.url() &&
            version.runningStatus === 'running',
        ),
      )
      .toBe(true);
    await page.bringToFront();
    await page.goto(`${root}/safe`);
    await page.waitForTimeout(200);
    const version = [...versions]
      .reverse()
      .find(
        (item) =>
          item.scriptURL === worker.url() && item.runningStatus === 'running',
      )!;
    await session.send('ServiceWorker.stopWorker', {
      versionId: version.versionId,
    });
    await page.waitForTimeout(1200);
    await expect(page.locator('input')).toHaveValue('');
    // A new popup wakes the worker but must not recreate the cancelled request.
    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(popup.locator('output')).toHaveText('IDLE');
    await page.bringToFront();
    await page.waitForTimeout(1000);
    await expect(page.locator('input')).toHaveValue('');
  } finally {
    await context.close();
  }
});
