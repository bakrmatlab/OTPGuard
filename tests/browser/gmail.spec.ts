import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { configuredGmail } from '../../apps/extension/gmail/config';
for (const phase of ['startup', 'action'] as const) {
  test(`popup survives absent Gmail worker response during ${phase}`, async () => {
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
      popup.on('pageerror', (error) => errors.push(error.message));
      await popup.addInitScript((phase) => {
        const send = chrome.runtime.sendMessage.bind(chrome.runtime);
        let initial = true;
        chrome.runtime.sendMessage = ((message: { type: string }) => {
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
      if (phase === 'action') {
        await expect(
          popup.getByText('No mailbox connected.', { exact: true }),
        ).toBeVisible();
        await popup
          .getByRole('button', { name: 'Check Gmail connection' })
          .click();
      }
      const fallback = configuredGmail()
        ? 'Gmail connection needs checking.'
        : 'Gmail connection is unconfigured.';
      await expect(popup.getByText(fallback, { exact: false })).toBeVisible();
      if (configuredGmail()) {
        await popup
          .getByRole('button', { name: /^(Re)?connect Gmail$/i })
          .click();
        await expect(popup.getByText(fallback, { exact: false })).toBeVisible();
      } else {
        await expect(
          popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }),
        ).toHaveCount(0);
      }
      await expect(
        popup.getByText('Real Gmail retrieval and autofill remain disabled.'),
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
      if (new URL(request.url()).protocol !== 'chrome-extension:')
        external.push(request.url());
    });
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    expect(new URL(worker.url()).host).toBe(configuredGmail()!.extensionId);
    await worker.evaluate(() => {
      let deny = true;
      chrome.identity.getAuthToken = async () => {
        if (deny) {
          deny = false;
          throw new Error('Synthetic denial');
        }
        return {
          token: 'synthetic-browser-credential',
          grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        };
      };
      chrome.identity.removeCachedAuthToken = async () => {};
      chrome.identity.clearAllCachedAuthTokens = async () => {};
      globalThis.fetch = async (url) =>
        new Response(
          String(url).includes('/profile')
            ? JSON.stringify({ emailAddress: 'mailbox@fixture.invalid' })
            : '',
          { status: 200 },
        );
    });
    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await expect(
      popup.getByText('No mailbox connected.', { exact: true }),
    ).toBeVisible();
    await popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }).click();
    await expect(
      popup.getByText('Connection was denied', { exact: false }),
    ).toBeVisible();
    await popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }).click();
    await expect(
      popup.getByText('Mailbox: mailbox@fixture.invalid'),
    ).toBeVisible();
    await expect(
      popup.getByText('Account authentication is unconfigured.'),
    ).toBeVisible();
    await worker.evaluate(() => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({ emailAddress: 'other@fixture.invalid' }),
          { status: 200 },
        );
    });
    await popup.getByRole('button', { name: 'Check Gmail connection' }).click();
    await expect(
      popup.getByText('Google returned a different mailbox.', { exact: false }),
    ).toBeVisible();
    await worker.evaluate(() => {
      globalThis.fetch = async () => {
        throw new Error('Synthetic offline');
      };
    });
    await popup.getByRole('button', { name: 'Disconnect Gmail' }).click();
    await expect(
      popup.getByText(
        'Disconnected locally. Google revocation could not be confirmed.',
        { exact: false },
      ),
    ).toBeVisible();
    await expect(popup.getByText('Mailbox:', { exact: false })).toHaveCount(0);
    await worker.evaluate(() => {
      globalThis.fetch = async (url) =>
        new Response(
          String(url).includes('/profile')
            ? JSON.stringify({ emailAddress: 'other@fixture.invalid' })
            : '',
          { status: 200 },
        );
    });
    await popup.getByRole('button', { name: /^(Re)?connect Gmail$/i }).click();
    await expect(
      popup.getByText('Mailbox: other@fixture.invalid'),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Disconnect Gmail' }).click();
    await expect(
      popup.getByText('No mailbox connected.', { exact: true }),
    ).toBeVisible();
    expect(external).toEqual([]);
  } finally {
    await context.close();
  }
});
