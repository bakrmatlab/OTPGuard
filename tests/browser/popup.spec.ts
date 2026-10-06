import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

async function popupContext() {
  const extension = resolve('apps/extension/build/chrome-mv3-prod');
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
}

test('minimal dark popup keeps Fill bound and suppresses repeated READY after a click', async () => {
  const context = await popupContext();
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 320, height: 500 });
    const errors: string[] = [];
    popup.on('pageerror', (error) => errors.push(error.name));
    await popup.addInitScript(() => {
      let state: Record<string, unknown> = {
        state: 'READY',
        requestId: 'synthetic-request',
      };
      const actions: unknown[] = [];
      Reflect.set(window, 'syntheticPopup', {
        actions,
        update: (next: Record<string, unknown>) => {
          state = next;
        },
      });
      chrome.permissions.contains = async () => true;
      chrome.runtime.sendMessage = ((message: { type: string }) => {
        if (message.type === 'account-status')
          return Promise.resolve({ state: 'SIGNED_IN' });
        if (message.type === 'pipeline-status') return Promise.resolve(state);
        actions.push(message);
        return Promise.resolve(true);
      }) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(
      popup.getByRole('heading', { name: 'Code found', exact: true }),
    ).toBeVisible();
    await expect(
      popup.getByRole('link', { name: 'Open OTPGuard' }),
    ).toHaveAttribute('href', 'https://otpguard.net/dashboard');
    await expect(popup.locator('input, textarea, details')).toHaveCount(0);
    expect(
      await popup
        .locator('body')
        .evaluate((body) => getComputedStyle(body).backgroundColor),
    ).toBe('rgb(8, 11, 11)');
    expect(
      await popup.evaluate(() => document.documentElement.scrollWidth <= 320),
    ).toBe(true);
    await popup.getByRole('button', { name: 'Fill', exact: true }).focus();
    await popup.keyboard.press('Enter');
    await expect(
      popup.getByRole('heading', { name: 'Inserting your code', exact: true }),
    ).toBeVisible();
    await expect(
      popup.getByRole('button', { name: 'Fill', exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        popup.evaluate(() => Reflect.get(window, 'syntheticPopup').actions),
      )
      .toEqual([{ type: 'pipeline-fill', requestId: 'synthetic-request' }]);
    await popup.evaluate(() =>
      Reflect.get(window, 'syntheticPopup').update({ state: 'FILLED' }),
    );
    await expect(
      popup.getByRole('heading', { name: 'Code inserted', exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('popup refusal, recovery and pending states never expose Fill', async () => {
  const context = await popupContext();
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const popup = await context.newPage();
    await popup.addInitScript(() => {
      let state: Record<string, unknown> = { state: 'IDLE' };
      const actions: unknown[] = [];
      Reflect.set(window, 'syntheticPopup', {
        actions,
        update: (next: Record<string, unknown>) => {
          state = next;
        },
      });
      chrome.permissions.contains = async () => true;
      chrome.runtime.sendMessage = ((message: { type: string }) => {
        if (message.type === 'account-status')
          return Promise.resolve({ state: 'SIGNED_IN' });
        if (message.type === 'pipeline-status') return Promise.resolve(state);
        actions.push(message);
        return Promise.resolve(true);
      }) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    const cases = [
      [{ state: 'SEARCHING' }, 'Finding a code…'],
      [{ state: 'NO_CODE' }, 'No code found'],
      [{ state: 'UNKNOWN', reason: 'ambiguity' }, 'Multiple possible codes'],
      [{ state: 'UNKNOWN', replay: 'already-used' }, 'Code already used'],
      [
        { state: 'UNKNOWN', replay: 'unavailable' },
        'Local protection unavailable',
      ],
      [{ state: 'BLOCKED' }, 'Site blocked'],
      [{ state: 'CANCELLED', cancellation: 'navigation' }, 'Page changed'],
      [{ state: 'DELIVERY_UNCONFIRMED' }, 'Insertion not confirmed'],
      [
        { state: 'EMAIL_CONFIRMATION_REQUIRED', requestId: 'synthetic' },
        'Is this an email code?',
      ],
    ] as const;
    for (const [state, title] of cases) {
      await popup.evaluate(
        (next) => Reflect.get(window, 'syntheticPopup').update(next),
        state,
      );
      await expect(
        popup.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        popup.getByRole('button', { name: 'Fill', exact: true }),
      ).toHaveCount(0);
    }
    await popup.getByRole('button', { name: 'This is an email code' }).click();
    expect(
      await popup.evaluate(() => Reflect.get(window, 'syntheticPopup').actions),
    ).toEqual([{ type: 'pipeline-confirm-email', requestId: 'synthetic' }]);
  } finally {
    await context.close();
  }
});

test('account uncertainty and permission failure keep setup outside the popup', async () => {
  const context = await popupContext();
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const popup = await context.newPage();
    await popup.addInitScript(() => {
      chrome.permissions.contains = async () => false;
      chrome.runtime.sendMessage = (() =>
        Promise.resolve({
          state: 'SIGN_IN_REQUIRED',
        })) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(
      popup.getByRole('heading', { name: 'Sign in to find a code' }),
    ).toBeVisible();
    await expect(popup.getByRole('button')).toHaveCount(0);
    await expect(
      popup.getByRole('link', { name: 'Open OTPGuard' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test('management loading and storage failures disable local mutations', async () => {
  const context = await popupContext();
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const page = await context.newPage();
    await page.addInitScript(() => {
      chrome.permissions.contains = async () => true;
      chrome.runtime.sendMessage = ((message: { type: string }) => {
        if (
          message.type === 'settings-status' ||
          message.type === 'history-status'
        )
          return Promise.reject(new Error('synthetic storage failure'));
        if (message.type === 'account-status')
          return Promise.resolve({ state: 'SIGNED_IN' });
        return Promise.resolve({ state: 'DISCONNECTED' });
      }) as typeof chrome.runtime.sendMessage;
    });
    await page.goto(
      `chrome-extension://${new URL(worker.url()).host}/management.html`,
    );
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add site' })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Export local history' }),
    ).toBeDisabled();
    await expect(
      page.getByText('Local history unavailable.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Fill', exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('Chrome native action popup keeps 320px content without clipping', async () => {
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
    await worker.evaluate(() => chrome.action.openPopup());
    // Native action popups are separate targets, not normal Playwright tabs.
    const session = await context.newCDPSession(context.pages()[0]!);
    const targets = await session.send('Target.getTargets');
    const target = targets.targetInfos.find((info) =>
      info.url.endsWith('/popup.html'),
    );
    expect(target).toBeDefined();
    const { sessionId } = await session.send('Target.attachToTarget', {
      targetId: target!.targetId,
      flatten: false,
    });
    const response = new Promise<string>((resolve, reject) => {
      session.on('Target.receivedMessageFromTarget', (event) => {
        const message = JSON.parse(event.message);
        if (message.id !== 1) return;
        if (message.result?.result?.value) resolve(message.result.result.value);
        else reject(new Error('Native popup measurement failed'));
      });
    });
    await session.send('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `new Promise(resolve => {
            const read = () => {
              const main = document.querySelector('main');
              if (!main) { requestAnimationFrame(read); return; }
              requestAnimationFrame(() => requestAnimationFrame(() => {
                const root = document.documentElement;
                resolve(JSON.stringify({
                  width: innerWidth,
                  clientWidth: root.clientWidth,
                  body: document.body.getBoundingClientRect().width,
                  mainLeft: main.getBoundingClientRect().left,
                  mainRight: main.getBoundingClientRect().right,
                  main: main.getBoundingClientRect().width,
                  overflow: root.scrollWidth > root.clientWidth,
                  fill: document.querySelector('.popup-site').getBoundingClientRect().width,
                }));
              }));
            };
            read();
          })`,
          awaitPromise: true,
          returnByValue: true,
        },
      }),
    });
    const dimensions = JSON.parse(await response);
    // Host chrome can vary; content must remain 320px without clipping.
    expect(dimensions.clientWidth).toBeGreaterThanOrEqual(320);
    expect(dimensions.clientWidth).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.body).toBe(320);
    expect(dimensions.mainLeft).toBe(0);
    expect(dimensions.mainRight).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(dimensions.main).toBe(320);
    expect(dimensions.overflow).toBe(false);
    expect(dimensions.fill).toBeGreaterThan(120);
  } finally {
    await context.close();
  }
});

test('one-time website setup explains generic matching and enables automatic finding without exposing a code', async () => {
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
    await popup.addInitScript(() => {
      const actions: unknown[] = [];
      Object.assign(window, { __setupActions: actions });
      chrome.permissions.contains = async () => false;
      chrome.permissions.request = async (value) => {
        actions.push(value);
        return true;
      };
      const send = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = ((value: { type: string }) => {
        if (value.type === 'settings-autofill') actions.push(value);
        return send(value);
      }) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/management.html`,
    );
    await expect(
      popup.getByText(
        'Fill does not verify the sender or its relationship to this website.',
        { exact: false },
      ),
    ).toBeVisible();
    await popup
      .getByRole('button', { name: 'Enable on websites', exact: true })
      .first()
      .click();
    await expect(
      popup
        .getByRole('button', { name: 'Enable on websites', exact: true })
        .first(),
    ).not.toBeVisible();
    expect(
      await popup.evaluate(() => Reflect.get(window, '__setupActions')),
    ).toEqual([
      { origins: ['https://*/*'] },
      { type: 'settings-autofill', enabled: true },
    ]);
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const value = (
            await chrome.storage.local.get('otpguard.settings.v1')
          )['otpguard.settings.v1'];
          return (
            !!value &&
            typeof value === 'object' &&
            'autofillEnabled' in value &&
            value.autofillEnabled === true
          );
        }),
      )
      .toBe(true);
    await expect(
      popup.getByRole('button', { name: 'Fill', exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('fresh installation finds codes by default and retains an explicit opt-out', async () => {
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
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/management.html`,
    );
    const automatic = popup.getByRole('checkbox', {
      name: /Find codes automatically/,
    });
    await expect(automatic).toBeChecked();
    expect(
      await popup.evaluate(() =>
        chrome.permissions.contains({ origins: ['https://*/*'] }),
      ),
    ).toBe(false);
    await expect(
      popup.getByRole('button', { name: 'Fill', exact: true }),
    ).toHaveCount(0);
    await automatic.click();
    await expect(automatic).not.toBeChecked();
    await popup.reload();
    await expect(automatic).not.toBeChecked();
  } finally {
    await context.close();
  }
});
