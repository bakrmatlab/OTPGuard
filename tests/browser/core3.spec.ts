import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Pipeline from '../fixtures/generic-pipeline';
let pipeline: typeof Pipeline;
let harnessDirectory: string;
test.beforeAll(async () => {
  // Bundle production seams together, as the extension does. Playwright's TS
  // loader cannot initialize their existing package re-export cycles directly.
  harnessDirectory = mkdtempSync(join(tmpdir(), 'otpguard-pipeline-fixture-'));
  const bundle = join(harnessDirectory, 'pipeline.mjs');
  execFileSync('bun', [
    'build',
    'tests/fixtures/generic-pipeline.ts',
    '--target=node',
    '--format=esm',
    '--outfile',
    bundle,
  ]);
  pipeline = await import(pathToFileURL(bundle).href);
});
test.afterAll(() => {
  if (harnessDirectory)
    rmSync(harnessDirectory, { recursive: true, force: true });
});
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
  ).toMatchObject([
    {
      type: 'detect',
      expectedLength: 0,
      allowedLengths: [4, 5, 6],
      emailFlow: true,
    },
  ]);
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
  expect(release).toEqual({ status: 'refused', reason: 'field-not-ready' });
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
  await page.clock.resume();
  const ready = await page.evaluate(async () => {
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
    let resolveRelease!: (value: unknown) => void;
    const released = new Promise((resolve) => {
      resolveRelease = resolve;
    });
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
        resolveRelease(v);
      },
    );
    return { prepared: result, released: await released };
  });
  expect(ready).toEqual({ prepared: true, released: true });
  await expect(page.locator('input')).toHaveValue('003719');
});

test('automatically detects a fresh SPA challenge after more than one minute on the login page', async ({
  page,
}) => {
  await page.clock.install();
  await page.route('https://www.canva.com/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><main><form><input type="email"></form></main>',
    }),
  );
  await page.goto('https://www.canva.com/login/');
  await page.evaluate(() => {
    const messages: unknown[] = [];
    Object.assign(window, {
      __late: messages,
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: async (v: unknown) => {
            messages.push(v);
          },
          onMessage: { addListener: () => {} },
        },
      },
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
  await page.clock.runFor(90000);
  await page.evaluate(() => {
    document.querySelector('main')!.innerHTML =
      '<div>Enter the code we sent to <strong>owner@example.test</strong><form><input autocomplete="one-time-code" inputmode="numeric" maxlength="6"></form></div>';
  });
  await page.clock.runFor(1000);
  expect(
    await page.evaluate(
      () => (window as unknown as { __late: unknown[] }).__late,
    ),
  ).toMatchObject([{ type: 'detect', manual: false, expectedLength: 0 }]);
  await expect(page.locator('input')).toHaveValue('');
});

test('generic content detects an unfamiliar HTTPS site with no maxlength and does not fill before approval', async ({
  page,
}) => {
  await page.route('https://new-login.example/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><form><p>Check your email for the code.</p><label>Code<input inputmode="numeric"></label></form>',
    }),
  );
  await page.goto('https://new-login.example/login');
  await page.evaluate(() => {
    const messages: unknown[] = [];
    Object.assign(window, {
      __genericMessages: messages,
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: async (v: unknown) => {
            messages.push(v);
          },
          onMessage: { addListener: () => {} },
        },
      },
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
  expect(
    await page.evaluate(() => Reflect.get(window, '__genericMessages')),
  ).toMatchObject([{ type: 'detect', expectedLength: 0, emailFlow: true }]);
  await expect(page.locator('input')).toHaveValue('');
});

// Synthetic input-otp structure: one real input beneath decorative digit slots.
// Clerk's public CodeControl uses this component rather than six native inputs.
for (const layout of ['blocks', 'inline'] as const)
  test(`detects and fills nested email code controls with ${layout} recipient text`, async ({
    page,
  }) => {
    await page.route('https://new-login.example/**', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><main><section><h2>Check your email</h2><p>to continue to Example</p><p>${layout === 'inline' ? '<span>person@</span><span>fixture.invalid</span>' : 'person@fixture.invalid'}</p><div><div><div><div style="position:relative;width:300px;height:48px"><div role="group">${'<span>□</span>'.repeat(6)}</div><div style="position:absolute;inset:0"><input aria-label="Enter verification code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" style="position:absolute;inset:0;width:100%;height:100%;color:transparent"></div></div></div></div></div><button>Resend</button></section></main>`,
      }),
    );
    await page.goto('https://new-login.example/login');
    await page.evaluate(() => {
      const messages: unknown[] = [];
      const listeners: ((
        v: unknown,
        sender: unknown,
        reply: (v: unknown) => void,
      ) => void)[] = [];
      Object.assign(window, {
        __nestedMessages: messages,
        __nestedListeners: listeners,
        chrome: {
          runtime: {
            id: 'fixture',
            sendMessage: async (v: unknown) => {
              messages.push(v);
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
    expect(
      await page.evaluate(() => Reflect.get(window, '__nestedMessages')),
    ).toMatchObject([
      {
        type: 'detect',
        expectedLength: 0,
        allowedLengths: [4, 5, 6],
        emailFlow: true,
        recipient: 'person@fixture.invalid',
      },
    ]);
    await expect(page.locator('input')).toHaveValue('');
    const {
      createAccountGate,
      createGmailLifecycle,
      GMAIL_SCOPE,
      createGmailTransport,
      createGmailPageCoordinator,
    } = pipeline;
    const gate = createAccountGate(async () => ({
      userId: 'fixture-user',
      sessionId: 'fixture-session',
      expiresAt: Date.now() + 60000,
      label: 'Synthetic',
    }));
    const mailbox = createGmailLifecycle(
      {
        token: async () => ({
          token: 'synthetic-token',
          grantedScopes: [GMAIL_SCOPE],
        }),
        profile: async () => 'person@fixture.invalid',
        remove: async () => {},
        clear: async () => {},
        revoke: async () => true,
      },
      true,
    );
    await mailbox.connect();
    let confirmFill: (() => void) | undefined;
    const coordinator = createGmailPageCoordinator(
      {
        now: Date.now,
        id: () => 'nested',
        settings: () => ({ autofillEnabled: true, blockedOrigins: [] }),
        context: async () => ({
          accountId: '',
          mailboxId: 'person@fixture.invalid',
          tabId: 1,
          documentId: 'nested-document',
          origin: 'https://new-login.example',
          browserUrl: 'https://new-login.example/login',
          policyUrl: 'https://new-login.example/login',
          serviceId: 'generic',
          foreground: true,
        }),
        current: async () => true,
        confirm: async () =>
          new Promise<boolean>((resolve) => {
            confirmFill = () => resolve(true);
          }),
        send: async (_context, message) =>
          page.evaluate(
            (message) =>
              new Promise((resolve) => {
                const listeners = Reflect.get(window, '__nestedListeners') as ((
                  v: unknown,
                  sender: unknown,
                  reply: (v: unknown) => void,
                ) => void)[];
                listeners[0]!(message, { id: 'fixture' }, resolve);
              }),
            message,
          ),
      },
      gate,
      mailbox,
      createGmailTransport(
        async (url) =>
          new Response(
            JSON.stringify(
              new URL(url).searchParams.has('format')
                ? {
                    id: 'synthetic-mail',
                    internalDate: String(Date.now()),
                    raw: Buffer.from(
                      'To: person@fixture.invalid\r\nSubject: Login code\r\nContent-Type: text/plain\r\n\r\nYour code is 003719',
                    ).toString('base64url'),
                  }
                : { messages: [{ id: 'synthetic-mail' }] },
            ),
          ),
      ),
    );
    try {
      const detected = await page.evaluate(
        () => Reflect.get(window, '__nestedMessages') as unknown[],
      );
      const result = coordinator.handle(detected[0], {});
      await expect.poll(() => !!confirmFill).toBe(true);
      await expect(page.locator('input')).toHaveValue('');
      confirmFill!();
      expect(await result).toEqual({ state: 'FILLED' });
    } finally {
      coordinator.dispose();
      gate.invalidate();
      mailbox.invalidate();
    }
    await expect(page.locator('input')).toHaveValue('003719');
  });

for (const resendLabel of [
  'Resend code',
  'Request a new code',
  'Send another code',
])
  test(`trusted ${resendLabel} starts a fresh request on the same fields`, async ({
    page,
  }) => {
    await page.route('https://login.fixture.invalid/**', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><section><p>Check your email person@fixture.invalid for a code</p><input autocomplete="one-time-code" maxlength="6"><button>${resendLabel}</button></section>`,
      }),
    );
    await page.goto('https://login.fixture.invalid/');
    await page.evaluate(() => {
      const messages: unknown[] = [];
      const listeners: ((
        v: unknown,
        s: unknown,
        reply: (v: unknown) => void,
      ) => void)[] = [];
      Object.assign(window, {
        __resend: { messages, listeners },
        chrome: {
          runtime: {
            id: 'fixture',
            sendMessage: async (v: unknown) => {
              messages.push(v);
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
    await page.evaluate(() => {
      const t = Reflect.get(window, '__resend');
      t.listeners[0](
        {
          type: 'prepare',
          requestId: 'old',
          groupId: 'fields-1',
          expectedLength: 6,
          expiresAt: Date.now() + 20000,
        },
        { id: 'fixture' },
        () => {},
      );
    });
    await page.locator('button').evaluate((button) => {
      if (button instanceof HTMLButtonElement) button.click();
    });
    expect(
      await page.evaluate(() => Reflect.get(window, '__resend').messages),
    ).toMatchObject([{ type: 'detect' }]);
    await page.getByRole('button', { name: resendLabel }).click();
    const messages = await page.evaluate(
      () => Reflect.get(window, '__resend').messages,
    );
    expect(messages).toMatchObject([
      { type: 'detect', recipient: 'person@fixture.invalid' },
      { type: 'cancel', requestId: 'old' },
      { type: 'challenge' },
      {
        type: 'detect',
        fresh: true,
        groupId: 'fields-1-challenge-1',
        allowedLengths: [4, 5, 6],
      },
    ]);
    await expect(page.locator('input')).toHaveValue('');
    await page.evaluate(() => {
      const t = Reflect.get(window, '__resend');
      t.listeners[0](
        {
          type: 'prepare',
          requestId: 'resent',
          groupId: 'fields-1-challenge-1',
          expectedLength: 6,
          expiresAt: Date.now() + 20000,
        },
        { id: 'fixture' },
        () => {},
      );
      const field = document.querySelector('input')!;
      field.replaceWith(field.cloneNode());
    });
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, '__resend').messages))
      .toMatchObject([
        { type: 'detect' },
        { type: 'cancel', requestId: 'old' },
        { type: 'challenge' },
        { type: 'detect', fresh: true },
        { type: 'cancel', requestId: 'resent' },
        { type: 'detect', replacement: true, groupId: 'fields-2-challenge-1' },
      ]);
    await expect(page.locator('input')).toHaveValue('');
  });

test('timestamps an email-request gesture before detecting the resulting code form', async ({
  page,
}) => {
  await page.route('https://login.fixture.invalid/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><section><input type="email" value="person@fixture.invalid"><button>Send code</button></section>',
    }),
  );
  await page.goto('https://login.fixture.invalid/');
  await page.evaluate(() => {
    const messages: unknown[] = [];
    Object.assign(window, {
      __early: messages,
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: async (v: unknown) => {
            messages.push(v);
          },
          onMessage: { addListener: () => {} },
        },
      },
    });
    document.querySelector('button')!.addEventListener('click', () => {
      document.querySelector('section')!.innerHTML =
        '<p>Check your email for a code</p><input autocomplete="one-time-code" maxlength="6">';
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, '__early')))
    .toMatchObject([
      { type: 'challenge' },
      { type: 'detect', emailFlow: true },
    ]);
  await expect(page.locator('input')).toHaveValue('');
});

test('invalidated content context stops messaging without uncaught errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://login.fixture.invalid/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><section><p>Check your email for a code</p><input autocomplete="one-time-code" maxlength="6"><button>Resend code</button></section>',
    }),
  );
  await page.goto('https://login.fixture.invalid/');
  await page.evaluate(() => {
    Object.assign(window, {
      __calls: 0,
      chrome: {
        runtime: {
          id: 'fixture',
          sendMessage: () => {
            Reflect.set(window, '__calls', Reflect.get(window, '__calls') + 1);
            throw new Error('Extension context invalidated.');
          },
          onMessage: { addListener: () => {} },
        },
      },
    });
  });
  await page.addScriptTag({
    content: readFileSync(artifact + '/content.js', 'utf8'),
  });
  await page.getByRole('button', { name: 'Resend code' }).click();
  await page.evaluate(() =>
    document
      .querySelector('input')!
      .replaceWith(document.querySelector('input')!.cloneNode()),
  );
  await page.waitForTimeout(1100);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => Reflect.get(window, '__calls'))).toBe(1);
  await expect(page.locator('input')).toHaveValue('');
});

test('resend records a challenge while fields are nonempty and rejects an old binding after delayed clearing', async ({
  page,
}) => {
  await page.route('https://login.fixture.invalid/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><section><p>Check your email for a code</p><input autocomplete="one-time-code" maxlength="6"><button>Resend code</button></section>',
    }),
  );
  await page.goto('https://login.fixture.invalid/');
  await page.evaluate(() => {
    const messages: unknown[] = [];
    const listeners: ((
      value: unknown,
      sender: unknown,
      reply: (value: unknown) => void,
    ) => void)[] = [];
    Object.assign(window, {
      __delayedResend: { messages, listeners },
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
  await page.locator('input').fill('9');
  await page.getByRole('button', { name: 'Resend code' }).click();
  expect(
    await page.evaluate(() => Reflect.get(window, '__delayedResend').messages),
  ).toMatchObject([
    { type: 'detect', groupId: 'fields-1' },
    { type: 'challenge' },
  ]);
  await expect(page.locator('input')).toHaveValue('9');
  // The site, not OTPGuard, clears its field after the request gesture.
  await page.locator('input').evaluate((input) => {
    (input as HTMLInputElement).value = '';
  });
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, '__delayedResend').messages),
    )
    .toMatchObject([
      { type: 'detect', groupId: 'fields-1' },
      { type: 'challenge' },
      { type: 'detect', groupId: 'fields-1-challenge-1', fresh: true },
    ]);
  const oldPrepare = await page.evaluate(() => {
    let result: unknown;
    Reflect.get(window, '__delayedResend').listeners[0](
      {
        type: 'prepare',
        requestId: 'old',
        groupId: 'fields-1',
        expectedLength: 6,
        expiresAt: Date.now() + 20000,
      },
      { id: 'fixture' },
      (value: unknown) => {
        result = value;
      },
    );
    return result;
  });
  expect(oldPrepare).toEqual({
    status: 'refused',
    reason: 'field-binding-changed',
  });
  await expect(page.locator('input')).toHaveValue('');
});

for (const [label, displayed, recipient] of [
  ['punctuation', 'person!tag@fixture.invalid', 'person!tag@fixture.invalid'],
  [
    'quoted local',
    '&quot;person&quot;@fixture.invalid',
    'person@fixture.invalid',
  ],
  [
    'personal alias',
    'First.Last+login@gmail.com',
    'First.Last+login@gmail.com',
  ],
  ['unicode unsupported', 'pérson@fixture.invalid', undefined],
  ['malformed suffix', 'person@fixture.invalid/bad', undefined],
  ['masked', 'p***@fixture.invalid', undefined],
  ['multiple', 'person@fixture.invalid or other@fixture.invalid', undefined],
] as const)
  test(`production recipient hint preserves uncertainty: ${label}`, async ({
    page,
  }) => {
    await page.route('https://recipient.example/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><main><section><h2>Check your email</h2><p>We sent a verification code to ${displayed}</p><label>Verification code<input autocomplete="one-time-code" maxlength="6"></label></section></main>`,
      }),
    );
    await page.goto('https://recipient.example/login');
    await page.evaluate(() => {
      const messages: unknown[] = [];
      Object.assign(window, {
        __recipientMessages: messages,
        chrome: {
          runtime: {
            id: 'fixture',
            sendMessage: async (value: unknown) => {
              messages.push(value);
            },
            onMessage: { addListener: () => {} },
          },
        },
      });
    });
    await page.addScriptTag({
      content: readFileSync(artifact + '/content.js', 'utf8'),
    });
    const messages = await page.evaluate(() =>
      Reflect.get(window, '__recipientMessages'),
    );
    expect(messages).toMatchObject([{ type: 'detect', emailFlow: true }]);
    expect(Reflect.get(messages[0] as object, 'recipient')).toBe(recipient);
    await expect(page.locator('input')).toHaveValue('');
  });

for (const phase of ['searching', 'prepared'])
  test(`production ${phase} binding is consumed by typing even when immediately cleared`, async ({
    page,
  }) => {
    await page.route('https://input.example.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<form><p>Email verification code</p><input autocomplete="one-time-code" maxlength="6"></form>',
      }),
    );
    await page.goto('https://input.example.test/');
    await page.evaluate(() => {
      const messages: unknown[] = [];
      const listeners: ((
        v: unknown,
        s: unknown,
        r: (v: unknown) => void,
      ) => void)[] = [];
      Object.assign(window, {
        __inputTest: { messages, listeners },
        chrome: {
          runtime: {
            id: 'fixture',
            sendMessage: async (v: unknown) => {
              messages.push(v);
            },
            onMessage: {
              addListener: (fn: (typeof listeners)[number]) =>
                listeners.push(fn),
            },
          },
        },
      });
    });
    await page.addScriptTag({
      content: readFileSync(artifact + '/content.js', 'utf8'),
    });
    const result = await page.evaluate((phase) => {
      const t = (
        window as unknown as {
          __inputTest: {
            messages: unknown[];
            listeners: ((
              v: unknown,
              s: unknown,
              r: (v: unknown) => void,
            ) => void)[];
          };
        }
      ).__inputTest;
      const binding = {
        requestId: 'request-edit',
        groupId: 'fields-1',
        expectedLength: 6,
        expiresAt: Date.now() + 20000,
      };
      let prepared: unknown;
      let released: unknown;
      if (phase === 'prepared')
        t.listeners[0]!(
          { type: 'prepare', ...binding },
          { id: 'fixture' },
          (v) => {
            prepared = v;
          },
        );
      const field = document.querySelector('input')!;
      field.value = '9';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.value = '';
      if (phase === 'searching')
        t.listeners[0]!(
          { type: 'prepare', ...binding },
          { id: 'fixture' },
          (v) => {
            prepared = v;
          },
        );
      t.listeners[0]!(
        { type: 'release', ...binding, code: '042681' },
        { id: 'fixture' },
        (v) => {
          released = v;
        },
      );
      return { prepared, released, value: field.value, messages: t.messages };
    }, phase);
    expect(result.prepared).toEqual(
      phase === 'prepared'
        ? true
        : { status: 'refused', reason: 'field-not-ready' },
    );
    expect(result.released).toEqual({
      status: 'refused',
      reason: 'field-not-ready',
    });
    expect(result.value).toBe('');
    if (phase === 'prepared')
      expect(result.messages).toContainEqual({
        type: 'cancel',
        requestId: 'request-edit',
      });
  });
