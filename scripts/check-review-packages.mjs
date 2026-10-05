import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import console from 'node:console';
import { clearTimeout, setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const scratch = await mkdtemp(join(tmpdir(), 'otpguard-review-smoke-'));
let server;
let browser;
let context;
let verificationError;
const bounded = async (promise, milliseconds) => {
  let timer;
  try {
    return await Promise.race([
      promise.then(
        () => true,
        () => false,
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
try {
  const provenance = JSON.parse(
    await readFile('dist/review/provenance.json', 'utf8'),
  );
  if (
    provenance.purpose !== 'unconfigured-local-review-only' ||
    provenance.packagingContext?.platform !== process.platform ||
    provenance.packagingContext?.architecture !== process.arch
  )
    throw new Error('Rebuild review packages for this platform/architecture');
  for (const name of ['web.zip', 'extension.zip']) {
    const record = provenance.archives.find((archive) => archive.name === name);
    const bytes = await readFile(`dist/review/${name}`);
    if (
      !record ||
      record.bytes !== bytes.length ||
      record.sha256 !== createHash('sha256').update(bytes).digest('hex')
    )
      throw new Error('Review archive does not match local provenance');
  }
  for (const name of ['web', 'extension'])
    execFileSync(
      'unzip',
      ['-q', `dist/review/${name}.zip`, '-d', join(scratch, name)],
      { stdio: 'pipe' },
    );
  const env = { ...process.env, PORT: '3201', HOSTNAME: '127.0.0.1' };
  for (const name of Object.keys(env))
    if (/^(?:PLASMO_PUBLIC_|NEXT_PUBLIC_CLERK_|CLERK_|CONVEX_)/.test(name))
      delete env[name];
  // Refuse occupied port before launching, never reuse/stop another server.
  const net = await import('node:net');
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(3201, '127.0.0.1', () => probe.close(resolve));
  });
  server = spawn(process.execPath, ['apps/web/server.js'], {
    cwd: join(scratch, 'web'),
    env,
    stdio: 'ignore',
  });
  let spawnFailed = false;
  server.on('error', () => {
    spawnFailed = true;
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnFailed || server.exitCode !== null || server.signalCode !== null)
      throw new Error('Packaged web server exited');
    try {
      ready = (
        await globalThis.fetch('http://127.0.0.1:3201', {
          signal: globalThis.AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {
      // Bounded startup probe, no provider request.
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Packaged web server did not start');
  browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage();
  const errors = [];
  const external = [];
  const assetFailures = [];
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:3201')
      external.push('external');
  });
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/_next/') &&
      !response.ok()
    )
      assetFailures.push(response.status());
  });
  await page.goto('http://127.0.0.1:3201');
  await expect(
    page.getByRole('heading', { name: 'Email codes, with less friction.' }),
  ).toBeVisible();
  await page.goto('http://127.0.0.1:3201/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 380, height: 800 });
  await page
    .getByRole('navigation', { name: 'Dashboard' })
    .getByRole('link', { name: 'Account & connections', exact: true })
    .click();
  await expect(page.locator('#connections')).toBeVisible();
  expect(
    await page.locator('body').evaluate((body) => body.scrollWidth <= 380),
  ).toBe(true);
  await page.goto('http://127.0.0.1:3201/sign-in');
  await expect(
    page.getByText('Account authentication is unconfigured.'),
  ).toBeVisible();
  await page.goto('http://127.0.0.1:3201/not-a-route');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(assetFailures).toEqual([]);
  const extension = join(scratch, 'extension');
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  const popup = await context.newPage();
  await popup.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup.html`,
  );
  await popup.locator('.management > summary').click();
  await popup.locator('#gmail-summary').click();
  await expect(
    popup
      .getByText('Gmail connection is unconfigured.', { exact: false })
      .first(),
  ).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Fill' })).toBeDisabled();
  console.log(
    'Extracted review packages passed: standalone routes/mobile/assets and MV3 worker/popup',
  );
} catch (error) {
  verificationError = error;
} finally {
  const closed = await bounded(
    Promise.all([context?.close(), browser?.close()]),
    2000,
  );
  let stopped = true;
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    stopped = await bounded(exited, 1000);
    if (!stopped) {
      server.kill('SIGKILL');
      stopped = await bounded(exited, 1000);
    }
  }
  let removed = true;
  try {
    await rm(scratch, { recursive: true, force: true });
  } catch {
    removed = false;
  }
  if (!verificationError && (!closed || !stopped || !removed))
    verificationError = new Error('Review smoke cleanup did not finish');
}
if (verificationError) throw verificationError;
