import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const artifact =
  process.env.OTPGuard_ARTIFACT ?? 'apps/extension/build/chrome-mv3-prod';

test('production content detects bounded nearby email challenge and preserves user input', async ({
  page,
}) => {
  await page.route('https://www.canva.com/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><h3>Finish logging in</h3><div>Once you enter the code we sent to <strong>owner@example.test</strong>, you will be logged in.<form><label>Code<input autocomplete="one-time-code" inputmode="numeric" maxlength="6" placeholder="Enter code"></label></form></div>',
    }),
  );
  await page.goto('https://www.canva.com/login/');
  await page.evaluate(() => {
    const messages: unknown[] = [];
    const listeners: ((
      v: unknown,
      s: unknown,
      r: (v: unknown) => void,
    ) => void)[] = [];
    Object.assign(window, {
      __test: { messages, listeners },
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: async (v: unknown) => {
            messages.push(v);
          },
          onMessage: {
            addListener: (fn: (typeof listeners)[number]) => listeners.push(fn),
          },
        },
      },
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __test: { messages: unknown[] } }).__test
          .messages,
    ),
  ).toMatchObject([{ type: 'detect', expectedLength: 6, emailFlow: true }]);
  await expect(page.locator('input')).toHaveValue('');
  const prepare = await page.evaluate(() => {
    const t = (
      window as unknown as {
        __test: {
          listeners: ((
            v: unknown,
            s: unknown,
            r: (v: unknown) => void,
          ) => void)[];
        };
      }
    ).__test;
    let result: unknown;
    t.listeners[0]!(
      {
        type: 'prepare',
        requestId: 'request-1',
        groupId: 'fields-1',
        expectedLength: 6,
        expiresAt: Date.now() + 20000,
      },
      { id: 'fixture' },
      (v) => {
        result = v;
      },
    );
    return result;
  });
  expect(prepare).toBe(true);
  await expect(page.locator('input')).toHaveValue('');
  await page.locator('input').fill('9');
  const release = await page.evaluate(() => {
    const t = (
      window as unknown as {
        __test: {
          listeners: ((
            v: unknown,
            s: unknown,
            r: (v: unknown) => void,
          ) => void)[];
        };
      }
    ).__test;
    let result: unknown;
    t.listeners[0]!(
      {
        type: 'release',
        requestId: 'request-1',
        groupId: 'fields-1',
        expectedLength: 6,
        expiresAt: Date.now() + 20000,
        code: '003719',
      },
      { id: 'fixture' },
      (v) => {
        result = v;
      },
    );
    return result;
  });
  expect(release).toBe(false);
  await expect(page.locator('input')).toHaveValue('9');
});

test('observer expiry does not invalidate a current manual Fill handoff', async ({
  page,
}) => {
  await page.clock.install();
  await page.route('https://www.canva.com/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><div>Enter the code we sent to <strong>owner@example.test</strong><form><input autocomplete="one-time-code" inputmode="numeric" maxlength="6"></form></div>',
    }),
  );
  await page.goto('https://www.canva.com/login/');
  await page.evaluate(() => {
    const listeners: ((
      v: unknown,
      s: unknown,
      r: (v: unknown) => void,
    ) => void)[] = [];
    Object.assign(window, {
      __handoff: { listeners },
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: async () => {},
          onMessage: {
            addListener: (f: (typeof listeners)[number]) => listeners.push(f),
          },
        },
      },
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
  await page.clock.runFor(59000);
  await page.evaluate(() => {
    const t = (
      window as unknown as {
        __handoff: {
          listeners: ((
            v: unknown,
            s: unknown,
            r: (v: unknown) => void,
          ) => void)[];
        };
      }
    ).__handoff;
    t.listeners[1]!(
      { type: 'scan', manual: true },
      { id: 'fixture' },
      () => {},
    );
  });
  await page.clock.runFor(2000);
  const ready = await page.evaluate(() => {
    const t = (
      window as unknown as {
        __handoff: {
          listeners: ((
            v: unknown,
            s: unknown,
            r: (v: unknown) => void,
          ) => void)[];
        };
      }
    ).__handoff;
    let result: unknown;
    let released: unknown;
    const expiresAt = Date.now() + 20000;
    t.listeners[0]!(
      {
        type: 'prepare',
        requestId: 'manual-handoff',
        groupId: 'fields-1',
        expectedLength: 6,
        expiresAt,
      },
      { id: 'fixture' },
      (v) => {
        result = v;
      },
    );
    t.listeners[0]!(
      {
        type: 'release',
        requestId: 'manual-handoff',
        groupId: 'fields-1',
        expectedLength: 6,
        expiresAt,
        code: '003719',
      },
      { id: 'fixture' },
      (v) => {
        released = v;
      },
    );
    return { prepared: result, released };
  });
  expect(ready).toEqual({ prepared: true, released: true });
  await expect(page.locator('input')).toHaveValue('003719');
});
