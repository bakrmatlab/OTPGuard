import { parseGenericCode } from '../../packages/otp/generic';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const artifact =
  process.env.OTPGuard_ARTIFACT ?? 'apps/extension/build/chrome-mv3-prod';
async function load(page: import('@playwright/test').Page, body: string) {
  await page.route('https://unfamiliar.fixture.invalid/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html>' + body }),
  );
  await page.goto('https://unfamiliar.fixture.invalid/login');
  await page.evaluate(() => {
    const messages: unknown[] = [];
    const listeners: ((
      value: unknown,
      sender: unknown,
      reply: (value: unknown) => void,
    ) => void)[] = [];
    Object.assign(window, {
      __recovery: { messages, listeners },
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: async (value: unknown) => {
            messages.push(value);
          },
          onMessage: {
            addListener: (listener: (typeof listeners)[number]) =>
              listeners.push(listener),
          },
        },
      },
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
}
async function scan(page: import('@playwright/test').Page, message: unknown) {
  return page.evaluate((message) => {
    const state = Reflect.get(window, '__recovery');
    let response: unknown;
    state.listeners.forEach(
      (
        listener: (
          value: unknown,
          sender: unknown,
          reply: (value: unknown) => void,
        ) => void,
      ) =>
        listener(message, { id: 'fixture' }, (value: unknown) => {
          response = value;
        }),
    );
    return response;
  }, message);
}
test('unrelated sidebar and navigation text do not disqualify the email challenge', async ({
  page,
}) => {
  await load(
    page,
    '<section><p>Enter the code sent to your email.</p><form><input autocomplete="one-time-code" maxlength="6"></form><aside>Phone number and recovery backup codes</aside><nav>Use an authenticator instead</nav></section>',
  );
  expect(
    await page.evaluate(() => Reflect.get(window, '__recovery').messages),
  ).toMatchObject([{ type: 'detect', emailFlow: true }]);
});
test('uncertain code field requires explicit email confirmation and retains group binding', async ({
  page,
}) => {
  await load(
    page,
    '<form><label>Verification code<input autocomplete="one-time-code" inputmode="numeric" maxlength="6"></label></form>',
  );
  expect(
    await page.evaluate(() => Reflect.get(window, '__recovery').messages),
  ).toEqual([]);
  expect(await scan(page, { type: 'scan', manual: true })).toEqual({
    state: 'EMAIL_CONFIRMATION_REQUIRED',
    groupId: 'fields-1',
  });
  expect(
    await page.evaluate(() => Reflect.get(window, '__recovery').messages),
  ).toEqual([]);
  expect(await scan(page, { type: 'confirm-email', groupId: 'fields-1' })).toBe(
    true,
  );
  expect(
    await page.evaluate(() => Reflect.get(window, '__recovery').messages),
  ).toMatchObject([{ type: 'detect', emailFlow: true, manual: true }]);
  await expect(page.locator('input')).toHaveValue('');
});
for (const body of [
  '<aside><form><label>Authenticator code<input autocomplete="one-time-code" maxlength="6"></label></form></aside>',
  '<form><label>Payment verification code<input autocomplete="one-time-code" maxlength="6"></label></form>',
]) {
  test(
    'explicit intent cannot override known unsafe context: ' + body,
    async ({ page }) => {
      await load(page, body);
      expect(await scan(page, { type: 'scan', manual: true })).toBe(false);
      expect(
        await scan(page, { type: 'confirm-email', groupId: 'fields-1' }),
      ).toBe(false);
      expect(
        await page.evaluate(() => Reflect.get(window, '__recovery').messages),
      ).toEqual([]);
    },
  );
}
test('replaced or nonempty fields cannot reuse the confirmation', async ({
  page,
}) => {
  await load(
    page,
    '<form><input autocomplete="one-time-code" maxlength="6"></form>',
  );
  expect(await scan(page, { type: 'scan', manual: true })).toMatchObject({
    groupId: 'fields-1',
  });
  await page
    .locator('input')
    .evaluate((field) => field.replaceWith(field.cloneNode(true)));
  expect(await scan(page, { type: 'confirm-email', groupId: 'fields-1' })).toBe(
    false,
  );
  await page.locator('input').fill('123');
  expect(await scan(page, { type: 'confirm-email', groupId: 'fields-2' })).toBe(
    false,
  );
  expect(
    await page.evaluate(() => Reflect.get(window, '__recovery').messages),
  ).toEqual([]);
});
for (const [name, fields, accepted] of [
  [
    'single mixed code',
    '<input autocomplete="one-time-code" maxlength="6">',
    true,
  ],
  [
    'split mixed code',
    '<div>' +
      '<input autocomplete="one-time-code" maxlength="1">'.repeat(6) +
      '</div>',
    true,
  ],
  ['number input', '<input type="number" autocomplete="one-time-code">', false],
  [
    'numeric pattern',
    '<input autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6">',
    false,
  ],
] as const) {
  test('production release respects format for ' + name, async ({ page }) => {
    await load(
      page,
      '<section><p>Enter your email verification code</p>' +
        fields +
        '</section>',
    );
    const binding = {
      requestId: 'format-request',
      groupId: fields.includes('maxlength="1"')
        ? 'fields-1-2-3-4-5-6'
        : 'fields-1',
      expectedLength: 6,
      expiresAt: Date.now() + 20000,
    };
    expect(await scan(page, { type: 'prepare', ...binding })).toBe(true);
    await expect(page.locator('input').first()).toHaveValue('');
    const released = await page.evaluate(async (binding) => {
      const state = Reflect.get(window, '__recovery');
      return new Promise((resolve) =>
        state.listeners[0](
          { type: 'release', ...binding, code: 'A7b9Q2' },
          { id: 'fixture' },
          resolve,
        ),
      );
    }, binding);
    expect(released).toBe(accepted);
    expect(
      await page
        .locator('input')
        .evaluateAll((fields) =>
          fields.map((field) => (field as HTMLInputElement).value).join(''),
        ),
    ).toBe(accepted ? 'A7b9Q2' : '');
  });
}

test('grouped email presentation fills two groups of three boxes without the display separator', async ({
  page,
}) => {
  const parsed = parseGenericCode({
    subject: 'Team confirmation code: A7B-C9D',
    text: 'Here is your confirmation code.\nA7B-C9D',
  });
  if (parsed.status !== 'candidate')
    throw new Error('Synthetic grouped parser refusal');
  await load(
    page,
    '<section><p>We sent an email. Enter the code here.</p><form><div>' +
      '<input autocomplete="one-time-code" maxlength="1">'.repeat(3) +
      '</div><span>–</span><div>' +
      '<input autocomplete="one-time-code" maxlength="1">'.repeat(3) +
      '</div></form></section>',
  );
  const binding = {
    requestId: 'grouped-request',
    groupId: 'fields-1-2-3-4-5-6',
    expectedLength: 6,
    expiresAt: Date.now() + 20000,
  };
  expect(await scan(page, { type: 'prepare', ...binding })).toBe(true);
  expect(
    await page
      .locator('input')
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement).value),
      ),
  ).toEqual(['', '', '', '', '', '']);
  expect(
    await page.evaluate(
      async ({ binding, code }) => {
        const state = Reflect.get(window, '__recovery');
        return new Promise((resolve) =>
          state.listeners[0](
            { type: 'release', ...binding, code },
            { id: 'fixture' },
            resolve,
          ),
        );
      },
      { binding, code: parsed.candidate.code },
    ),
  ).toBe(true);
  expect(
    await page
      .locator('input')
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement).value),
      ),
  ).toEqual(['A', '7', 'B', 'C', '9', 'D']);
});
for (const length of [4, 5, 6, 7, 8])
  for (const layout of ['single', 'split']) {
    test(`format matrix preserves all character families at length ${length} in ${layout} fields`, async ({
      page,
    }) => {
      for (const code of ['00371928', 'AbCdEfGh', 'A7b9Q2x8'].map((value) =>
        value.slice(0, length),
      )) {
        const fields =
          layout === 'single'
            ? `<input autocomplete="one-time-code" minlength="${length}" maxlength="${length}" pattern="[A-Za-z0-9]{${length}}">`
            : '<div>' +
              '<input autocomplete="one-time-code" maxlength="1" pattern="[A-Za-z0-9]">'.repeat(
                length,
              ) +
              '</div>';
        await load(
          page,
          '<section><p>Enter the code sent to your email</p>' +
            fields +
            '</section>',
        );
        const binding = {
          requestId: 'matrix-request',
          groupId:
            layout === 'single'
              ? 'fields-1'
              : 'fields-' +
                Array.from({ length }, (_, index) => index + 1).join('-'),
          expectedLength: length,
          expiresAt: Date.now() + 20000,
        };
        expect(await scan(page, { type: 'prepare', ...binding })).toBe(true);
        expect(
          await page
            .locator('input')
            .evaluateAll((fields) =>
              fields.map((field) => (field as HTMLInputElement).value).join(''),
            ),
        ).toBe('');
        expect(
          await page.evaluate(
            async ({ binding, code }) => {
              const state = Reflect.get(window, '__recovery');
              return new Promise((resolve) =>
                state.listeners[0](
                  { type: 'release', ...binding, code },
                  { id: 'fixture' },
                  resolve,
                ),
              );
            },
            { binding, code },
          ),
        ).toBe(true);
        expect(
          await page
            .locator('input')
            .evaluateAll((fields) =>
              fields.map((field) => (field as HTMLInputElement).value).join(''),
            ),
        ).toBe(code);
      }
    });
  }
