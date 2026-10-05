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
      let failed = false;
      const pending = new Set<() => void>();
      Object.defineProperty(window, 'failWorkerRequests', {
        value() {
          failed = true;
          for (const reject of pending) reject();
          pending.clear();
        },
      });
      chrome.runtime.sendMessage = (() =>
        new Promise((_, reject) => {
          const fail = () => reject(new Error('Synthetic worker unavailable'));
          if (failed) fail();
          else pending.add(fail);
        })) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(popup.getByText('Checking Gmail connection…')).toBeVisible();
    await popup.locator('.management > summary').click();
    await popup.locator('#settings-summary').click();
    await popup.locator('#history-summary').click();
    await expect(popup.getByRole('checkbox')).toBeDisabled();
    // Hold loading until its assertions finish, regardless of CI scheduling.
    await popup.evaluate(() => {
      const fail = Reflect.get(window, 'failWorkerRequests');
      if (typeof fail !== 'function')
        throw new Error('Missing synthetic failure gate');
      fail();
    });
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
    await expect(popup.getByRole('button', { name: 'Fill' })).toBeDisabled();
    await expect(
      popup.getByRole('button', { name: 'Find code / Retry' }),
    ).toBeEnabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('compact popup presents synthetic request states and keyboard disclosure without releasing a code', async () => {
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
    await popup.setViewportSize({ width: 380, height: 600 });
    await popup.addInitScript(() => {
      let state = {
        state: 'READY',
        requestId: 'synthetic-request',
        prompt: 'manual',
      };
      const actions: string[] = [];
      Object.defineProperty(window, 'syntheticPopup', {
        value: {
          update(value: typeof state) {
            state = value;
          },
          actions,
        },
      });
      chrome.runtime.sendMessage = ((message: {
        type: string;
        requestId?: string;
      }) => {
        if (message.type === 'pipeline-status') return Promise.resolve(state);
        if (message.type === 'account-status')
          return Promise.resolve({
            state: 'SIGNED_IN',
            label: 'owner@fixture.invalid',
          });
        if (message.type === 'gmail-status')
          return Promise.resolve({
            state: 'CONNECTED',
            mailbox: 'mailbox@fixture.invalid',
          });
        if (message.type === 'settings-status')
          return Promise.resolve({
            state: 'LOCAL',
            autofillEnabled: true,
            blockedOrigins: [],
          });
        if (message.type === 'history-status')
          return Promise.resolve({ state: 'LOCAL', count: 0 });
        actions.push(message.type);
        if (message.type === 'pipeline-fill') {
          if (message.requestId !== 'synthetic-request')
            throw new Error('Wrong request binding');
          state = { ...state, state: 'FILLED' };
        }
        return Promise.resolve(true);
      }) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(
      popup.getByRole('heading', { name: 'Code found' }),
    ).toBeVisible();
    await expect(
      popup.getByText('Local matching', { exact: true }),
    ).toBeVisible();
    await expect(popup.getByText('Canva pilot', { exact: true })).toHaveCount(
      0,
    );
    const fill = popup.getByRole('button', { name: 'Fill', exact: true });
    await expect(fill).toBeEnabled();
    expect(await fill.boundingBox()).toMatchObject({ y: expect.any(Number) });
    expect(
      await fill.evaluate((el) => el.getBoundingClientRect().bottom),
    ).toBeLessThan(300);
    expect(
      await popup.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(380);
    expect(
      await popup
        .locator('main')
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(600);
    expect(
      await popup.evaluate(() => Reflect.get(window, 'syntheticPopup').actions),
    ).toEqual([]);
    if (process.env.OTPGUARD_POPUP_PREVIEW)
      await popup.screenshot({
        path: process.env.OTPGUARD_POPUP_PREVIEW,
        fullPage: true,
      });
    await popup
      .getByRole('button', { name: 'Manage connections', exact: true })
      .click();
    await expect(popup.locator('#gmail-summary')).toBeFocused();
    await expect(
      popup.getByText('Mailbox: mailbox@fixture.invalid'),
    ).toBeVisible();
    await expect(popup.locator('details.management')).toHaveAttribute(
      'open',
      '',
    );
    expect(
      await popup.evaluate(() => Reflect.get(window, 'syntheticPopup').actions),
    ).toEqual([]);
    if (process.env.OTPGUARD_POPUP_PREVIEW)
      await popup.screenshot({
        path: process.env.OTPGUARD_POPUP_PREVIEW.replace(
          '.png',
          '-connections.png',
        ),
        fullPage: true,
      });
    await popup.locator('.management > summary').click();
    await fill.click();
    await expect(
      popup.getByRole('heading', { name: 'Code inserted', exact: true }),
    ).toBeVisible();
    await popup.evaluate(() =>
      Reflect.get(window, 'syntheticPopup').update({
        state: 'SEARCHING',
        progress: {
          stage: 'decoding',
          elapsedSeconds: 12,
          stageSeconds: 3,
          steps: ['listing', 'fetching', 'decoding', 'template'],
        },
      }),
    );
    await expect(
      popup.getByText('Checking recent emails · 12s elapsed'),
    ).toBeVisible();
    await popup.getByText('Request progress', { exact: true }).click();
    await expect(
      popup.getByText(
        'A recent message was excluded: code wording was not recognized',
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    const states: [string, string][] = [
      ['SEARCHING', 'Looking for your code'],
      ['NO_CODE', 'No eligible code found'],
      ['UNKNOWN', 'Could not select a code'],
      ['ACCOUNT_UNAVAILABLE', 'Sign in to find your code'],
      ['MAILBOX_UNAVAILABLE', 'Reconnect Gmail'],
      ['NO_CHALLENGE', 'Code field not detected'],
      ['MISMATCH', 'Destination does not match'],
      ['BLOCKED', 'This site is blocked'],
      ['ERROR', 'Could not complete the request'],
      ['CANCELLED', 'Request stopped'],
      ['IDLE', 'Ready when you need a code'],
    ];
    for (const [state, title] of states) {
      await popup.evaluate(
        (state) =>
          Reflect.get(window, 'syntheticPopup').update({
            state,
            cancellation: 'confirmation-expired',
          }),
        state,
      );
      await expect(
        popup.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
      await expect(fill).toBeDisabled();
      if (
        process.env.OTPGUARD_POPUP_PREVIEW &&
        ['SEARCHING', 'NO_CODE', 'CANCELLED'].includes(state)
      )
        await popup.screenshot({
          path: process.env.OTPGUARD_POPUP_PREVIEW.replace(
            '.png',
            '-' + state.toLowerCase() + '.png',
          ),
          fullPage: true,
        });
      if (state === 'CANCELLED')
        await expect(popup.getByRole('status')).toContainText(
          'expired before confirmation',
        );
    }
    for (const [stage, text] of [
      ['messages-ambiguous', 'Multiple recent emails contain plausible codes'],
      [
        'codes-ambiguous',
        'One email contains multiple plausible numeric codes',
      ],
      [
        'requests-ambiguous',
        'Competing login requests or code field groups were detected',
      ],
      [
        'retrieval-incomplete',
        'Email retrieval did not return a complete candidate set',
      ],
    ]) {
      await popup.evaluate(
        (stage) =>
          Reflect.get(window, 'syntheticPopup').update({
            state: 'UNKNOWN',
            reason: 'ambiguity',
            progress: {
              stage,
              elapsedSeconds: 8,
              stageSeconds: 0,
              steps: ['selecting', stage],
            },
          }),
        stage,
      );
      await expect(popup.getByRole('status')).toHaveText(
        text + '. No code was released.',
      );
      await expect(fill).toBeDisabled();
    }
    await popup.evaluate(() =>
      Reflect.get(window, 'syntheticPopup').update({
        state: 'UNKNOWN',
        retrievalIssue: 'mime',
      }),
    );
    await expect(popup.getByRole('status')).toContainText(
      'format that could not be decoded',
    );
    await expect(fill).toBeDisabled();
    await popup.evaluate(() =>
      Reflect.get(window, 'syntheticPopup').update({
        state: 'UNKNOWN',
        retrievalIssue: 'mime-duplicate-headers',
      }),
    );
    await expect(popup.getByRole('status')).toContainText(
      'Email decoding stopped at duplicate-headers',
    );
    await popup.locator('.management > summary').focus();
    await popup.keyboard.press('Enter');
    await popup.locator('#settings-summary').focus();
    await popup.keyboard.press('Enter');
    await expect(popup.getByRole('checkbox')).toBeVisible();
    await popup.keyboard.press('Tab');
    await expect(popup.getByRole('checkbox')).toBeFocused();
    await popup.locator('#settings-summary').focus();
    await popup.keyboard.press('Space');
    await expect(popup.getByRole('checkbox')).not.toBeVisible();
    expect(
      await popup.evaluate(() => Reflect.get(window, 'syntheticPopup').actions),
    ).toEqual(['pipeline-fill']);
    // Reproduce the owner's combined state: stale UNKNOWN plus signed-out account.
    await popup.addInitScript(() => {
      const send = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = ((message: { type: string }) => {
        if (message.type === 'account-status')
          return Promise.resolve({ state: 'SIGN_IN_REQUIRED' });
        if (message.type === 'pipeline-status')
          return Promise.resolve({ state: 'UNKNOWN' });
        return send(message);
      }) as typeof chrome.runtime.sendMessage;
    });
    await popup.reload();
    await expect(
      popup.getByRole('heading', {
        name: 'Sign in to find your code',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      popup.getByRole('button', { name: 'Fill', exact: true }),
    ).toBeDisabled();
  } finally {
    await context.close();
  }
});

test('Chrome native action popup chooses the full 380px document width', async () => {
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
          expression: `new Promise(resolve => { const read = () => { if (!document.querySelector('main')) { requestAnimationFrame(read); return; } requestAnimationFrame(() => requestAnimationFrame(() => resolve(JSON.stringify({ width: innerWidth, main: document.querySelector('main').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth, fill: document.querySelector('.actions button').getBoundingClientRect().width })))); }; read(); })`,
          awaitPromise: true,
          returnByValue: true,
        },
      }),
    });
    const dimensions = JSON.parse(await response);
    expect(dimensions.width).toBe(380);
    expect(dimensions.main).toBe(380);
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
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(
      popup.getByText(
        'Matching does not verify that the email belongs to the website.',
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
    ).toBeDisabled();
  } finally {
    await context.close();
  }
});
