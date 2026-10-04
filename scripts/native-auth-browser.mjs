import { chromium, expect } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
/* global fetch, AbortSignal */

const live = process.argv.includes('--live');
const interactive = process.argv.includes('--interactive');
const extension = resolve('build/native-auth-prototype');
const manifest = JSON.parse(
  await readFile(join(extension, 'manifest.json'), 'utf8'),
);
const clerk = manifest.host_permissions[0].slice(0, -2);
const convex = manifest.host_permissions[1].slice(0, -2);
const profile = await mkdtemp(join(tmpdir(), 'otpguard-native-browser-'));
let context;
let violations = 0;
let stage = 'launch';
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: !interactive,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'https:') return;
    if (
      ![clerk, convex].includes(url.origin) ||
      (url.origin === clerk && url.search !== '?_is_native=1') ||
      (url.origin === convex && url.search)
    )
      violations++;
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  stage = 'page';
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/login.html`);
  await expect(page.locator('#status')).toHaveAttribute(
    'data-state',
    'SIGN_IN_REQUIRED',
  );
  if (live) {
    const bootstrap = await worker.evaluate(async (origin) => {
      const response = await fetch(origin + '/v1/client?_is_native=1', {
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json();
      return {
        ok: response.ok,
        header: !!response.headers.get('Authorization'),
        client: data.response?.object === 'client',
      };
    }, clerk);
    expect(bootstrap).toEqual({ ok: true, header: true, client: true });
    // Anonymous probe must fail; never print provider response/error details.
    const anonymousRejected = await worker.evaluate(async (origin) => {
      const response = await fetch(origin + '/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'authProbe:subject',
          args: {},
          format: 'json',
        }),
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json();
      return data.status === 'error';
    }, convex);
    expect(anonymousRejected).toBe(true);
    console.log(
      'Live Chromium native header bootstrap and anonymous Convex rejection passed.',
    );
  } else {
    stage = 'synthetic-start';
    await context.route(clerk + '/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const session = {
        id: 'sess_fixture',
        status: 'active',
        expire_at: Date.now() + 60_000,
        user: { id: 'user_fixture' },
      };
      let response = { response: session };
      if (path === '/v1/client')
        response = {
          response: {
            object: 'client',
            last_active_session_id: 'sess_fixture',
          },
        };
      if (path.endsWith('/sign_ins'))
        response = {
          response: {
            id: 'sia_fixture',
            status: 'needs_first_factor',
            supported_first_factors: [{ strategy: 'password' }],
          },
        };
      if (path.endsWith('/attempt_first_factor'))
        response = {
          response: {
            id: 'sia_fixture',
            status: 'complete',
            created_session_id: 'sess_fixture',
          },
        };
      if (path.endsWith('/tokens/convex'))
        response = { jwt: 'synthetic-token' };
      if (path.endsWith('/sign_ups') || path.endsWith('/prepare_verification'))
        response = {
          response: {
            id: 'sua_fixture',
            status: 'missing_requirements',
            missing_fields: [],
            unverified_fields: ['email_address'],
          },
        };
      if (path.endsWith('/attempt_verification'))
        response = {
          response: {
            id: 'sua_fixture',
            status: 'complete',
            created_session_id: 'sess_fixture',
          },
        };
      return route.fulfill({
        json: response,
        headers: { Authorization: 'synthetic-client' },
      });
    });
    await context.route(convex + '/**', (route) =>
      route.fulfill({ json: { status: 'success', value: 'user_fixture' } }),
    );
    await page.locator('#login-mode').click();
    await page.locator('#identifier').fill('synthetic@example.invalid');
    await page.locator('#continue').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'FIRST_FACTOR_REQUIRED',
    );
    stage = 'synthetic-verify';
    await page.locator('#secret').fill('synthetic-password');
    await page.locator('#continue').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'SIGNED_IN',
    );
    await expect(page.locator('#secret')).toHaveValue('');
    stage = 'synthetic-convex';
    await page.locator('#convex').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'CONVEX_IDENTITY_VERIFIED',
    );
    stage = 'synthetic-logout';
    await page.locator('#logout').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'SIGNED_OUT',
    );
    stage = 'synthetic-registration';
    await page.locator('#create-mode').click();
    await page.locator('#password').fill('synthetic-password');
    await page.locator('#continue').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'EMAIL_VERIFICATION_REQUIRED',
    );
    await expect(page.locator('#password')).toHaveValue('');
    await page.locator('#secret').fill('synthetic-code');
    await page.locator('#continue').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'SIGNED_IN',
    );
    await page.locator('#logout').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'SIGNED_OUT',
    );
    stage = 'browser-origin-conflict';
    await context.route(clerk + '/v1/client/sign_ups?*', (route) =>
      route.fulfill({
        status: 400,
        json: { errors: [{ code: 'origin_authorization_headers_conflict' }] },
      }),
    );
    await page.locator('#create-mode').click();
    await page.locator('#password').fill('synthetic-password');
    await page.locator('#continue').click();
    await expect(page.locator('#status')).toHaveAttribute(
      'data-state',
      'BROWSER_TRANSPORT_UNSUPPORTED',
    );
    await expect(page.locator('#status')).toContainText(
      'Retrying your details will not fix this',
    );
    await expect(page.locator('#password')).toHaveValue('');
    console.log(
      'Synthetic Chromium login, registration, credential clearing, Convex identity, logout and transport refusal passed.',
    );
  }
  expect(violations).toBe(0);
  if (interactive) {
    console.log('Owner login page is open. Credentials stay in the browser.');
    const allowed = new Set([
      'SIGNED_IN',
      'CONVEX_IDENTITY_VERIFIED',
      'SIGNED_OUT',
      'LOCAL_SIGN_OUT',
      'REQUEST_FAILED',
      'PROVIDER_REJECTED',
      'UNSUPPORTED_FACTOR',
      'AUTH_UNAVAILABLE',
      'ACCOUNT_NOT_FOUND',
      'PASSWORD_TOO_SHORT',
      'PASSWORD_REJECTED',
      'CODE_REJECTED',
      'CAPTCHA_REQUIRED',
      'BROWSER_TRANSPORT_UNSUPPORTED',
    ]);
    let last = '';
    for (let i = 0; i < 600; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (page.isClosed()) break;
      const state = await page.locator('#status').getAttribute('data-state');
      if (state !== last && allowed.has(state ?? '')) {
        console.log('Owner acceptance state:', state);
        last = state;
      }
    }
    expect(violations).toBe(0);
  }
} catch {
  console.error(
    `Native browser verification failed at ${stage}; sensitive diagnostics suppressed.`,
  );
  process.exitCode = 1;
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
