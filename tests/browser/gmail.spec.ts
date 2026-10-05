import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { configuredGmail } from '../../apps/extension/gmail/config';
for (const phase of ['startup', 'action'] as const) {
  test(`popup survives absent Gmail worker response during ${phase}`, async () => {
    const extension = resolve(
      process.env.OTPGUARD_TEST_EXTENSION ??
        'apps/extension/build/chrome-mv3-prod',
    );
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
      popup.on('pageerror', (error) => errors.push(error.message));
      await popup.addInitScript((phase) => {
        const send = chrome.runtime.sendMessage.bind(chrome.runtime);
        let initial = true;
        chrome.runtime.sendMessage = ((message: { type: string }) => {
          if (message.type === 'account-status')
            return Promise.resolve({
              state: 'SIGNED_IN',
              label: 'Synthetic account',
            });
          if (!message.type.startsWith('gmail-')) return send(message);
          if (phase === 'action' && initial) {
            initial = false;
            return Promise.resolve({ state: 'DISCONNECTED' });
          }
          return Promise.resolve(undefined);
        }) as typeof chrome.runtime.sendMessage;
      }, phase);
      await popup.goto(
        `chrome-extension://${new URL(worker.url()).host}/popup.html`,
      );
      await popup.locator('.management > summary').click();
      await popup.locator('#gmail-summary').click();
      if (phase === 'action') {
        await expect(
          popup.getByText('No mailbox connected.', { exact: true }).first(),
        ).toBeVisible();
        await popup
          .getByRole('button', { name: 'Check Gmail connection' })
          .click();
      }
      const fallback = configuredGmail()
        ? 'Gmail connection needs checking.'
        : 'Gmail connection is unconfigured.';
      await expect(
        popup.getByText(fallback, { exact: false }).first(),
      ).toBeVisible();
      if (configuredGmail()) {
        await popup
          .getByRole('button', { name: /^(Re)?connect Gmail$/i })
          .click();
        await expect(
          popup.getByText(fallback, { exact: false }).first(),
        ).toBeVisible();
      } else {
        await expect(
          popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }),
        ).toHaveCount(0);
      }
      await popup.getByText('How code matching works', { exact: true }).click();
      await expect(
        popup.getByText('Every insertion requires your click', {
          exact: false,
        }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
test('configured popup drives synthetic denial, reconnect, mailbox change and revocation failure', async () => {
  test.skip(
    !configuredGmail(),
    'Requires artifact-only public configuration build; never live OAuth',
  );
  const extension = resolve(
    process.env.OTPGUARD_TEST_EXTENSION ??
      'apps/extension/build/chrome-mv3-prod',
  );
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
      if (new URL(request.url()).protocol !== 'chrome-extension:')
        external.push(request.url());
    });
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    expect(new URL(worker.url()).host).toBe(configuredGmail()!.extensionId);
    const popup = await context.newPage();
    let declineDisconnect = true;
    popup.on('dialog', (dialog) => {
      expect(dialog.message()).toContain('all OAuth clients');
      if (declineDisconnect) {
        declineDisconnect = false;
        void dialog.dismiss();
      } else void dialog.accept();
    });
    // UI-only synthetic states. Actual worker authorization is covered separately.
    await popup.addInitScript(() => {
      const send = chrome.runtime.sendMessage.bind(chrome.runtime);
      const connections = [
        { state: 'CONNECT_FAILED' },
        { state: 'CONNECTED', mailbox: 'mailbox@fixture.invalid' },
        { state: 'CONNECTED', mailbox: 'other@fixture.invalid' },
      ];
      const checks = [{ state: 'DISCONNECTED' }, { state: 'MAILBOX_CHANGED' }];
      const disconnects = [
        { state: 'DISCONNECTED_REVOCATION_UNCONFIRMED' },
        { state: 'DISCONNECTED' },
      ];
      chrome.runtime.sendMessage = ((message: { type: string }) => {
        if (message.type === 'account-status')
          return Promise.resolve({
            state: 'SIGNED_IN',
            label: 'Synthetic account',
          });
        if (message.type === 'gmail-connect')
          return Promise.resolve(connections.shift());
        if (message.type === 'gmail-status')
          return Promise.resolve(checks.shift());
        if (message.type === 'gmail-disconnect')
          return Promise.resolve(disconnects.shift());
        return send(message);
      }) as typeof chrome.runtime.sendMessage;
    });
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await popup.locator('.management > summary').click();
    await popup.locator('#gmail-summary').click();
    await expect(
      popup.getByText('No mailbox connected.', { exact: true }).first(),
    ).toBeVisible();
    await popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }).click();
    await expect(
      popup.getByText('Connection was denied', { exact: false }).first(),
    ).toBeVisible();
    await popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }).click();
    await expect(
      popup.getByText('Mailbox: mailbox@fixture.invalid'),
    ).toBeVisible();
    await expect(
      popup.getByText('Synthetic account', { exact: true }).first(),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Check Gmail connection' }).click();
    await expect(
      popup
        .getByText('Google returned a different mailbox.', { exact: false })
        .first(),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Disconnect Gmail' }).click();
    await expect(
      popup
        .getByText('Google returned a different mailbox.', { exact: false })
        .first(),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Disconnect Gmail' }).click();
    await expect(
      popup
        .getByText(
          'Disconnected locally. Google revocation could not be confirmed.',
          { exact: false },
        )
        .first(),
    ).toBeVisible();
    await expect(popup.getByText('Mailbox:', { exact: false })).toHaveCount(0);
    await popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }).click();
    await expect(
      popup.getByText('Mailbox: other@fixture.invalid'),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Disconnect Gmail' }).click();
    await expect(
      popup.getByText('No mailbox connected.', { exact: true }).first(),
    ).toBeVisible();
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});
