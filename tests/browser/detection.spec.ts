import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:3001');
});

test('single/split evidence and conservative rejection in a real DOM', async ({
  page,
}) => {
  await expect(page.locator('#result')).toContainText('email-context');
  const snapshot = JSON.parse(await page.locator('#result').innerText());
  expect(snapshot.limited).toBe(false);
  expect(
    snapshot.groups.map((group: { fields: string[]; flow: string }) => [
      group.fields,
      group.flow,
    ]),
  ).toEqual([
    [['single'], 'email'],
    [Array(6).fill('split'), 'email'],
    [['authenticator'], 'uncertain'],
    [['ambiguous'], 'uncertain'],
  ]);
  expect(
    await page
      .locator('input')
      .evaluateAll((inputs) =>
        inputs.every((input) => (input as HTMLInputElement).value === ''),
      ),
  ).toBe(true);
});

test('replacement changes identity; repeated mutations do not duplicate results', async ({
  page,
}) => {
  const initial = await page.locator('#result').innerText();
  await page.locator('#replace').click();
  await expect(page.locator('#result')).not.toHaveText(initial);
  const replacement = await page.locator('#result').innerText();
  await page.locator('#single').evaluate((form) => {
    for (let index = 0; index < 10; index++)
      form.setAttribute('data-test', String(index));
  });
  await page.waitForTimeout(250);
  expect(await page.locator('#result').innerText()).toBe(replacement);
  await page.locator('#single').evaluate((form) => form.remove());
  await expect(page.locator('#result')).not.toContainText('single');
});

test('visibility, disabled split member, and bounded traversal fail safely', async ({
  page,
}) => {
  await page.locator('#single').evaluate((form) => {
    form.style.opacity = '0';
  });
  await page
    .locator('#split input')
    .first()
    .evaluate((input) => {
      (input as HTMLInputElement).disabled = true;
    });
  await expect(page.locator('#result')).not.toContainText('single');
  await expect(page.locator('#result')).not.toContainText('split');
  await page.evaluate(() => {
    const root = document.createElement('div');
    for (let i = 0; i < 201; i++) root.append(document.createElement('input'));
    document.body.append(root);
  });
  await expect(page.locator('#result')).toHaveText(
    '{"groups":[],"limited":true}',
  );
});

test('finite sessions clear groups on expiry and stop observing', async ({
  page,
}) => {
  const events = await page.evaluate(async () => {
    const modulePath = '/harness.js';
    const { observeDetection } = await import(modulePath);
    const events: number[] = [];
    observeDetection(
      document,
      (snapshot: { groups: unknown[] }) => events.push(snapshot.groups.length),
      { durationMs: 50 },
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    document.querySelector('#single')!.remove();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return events;
  });
  expect(events).toEqual([4, 0]);
});

test('detector refuses even same-origin iframe documents', async ({ page }) => {
  const snapshot = await page.evaluate(async () => {
    const modulePath = '/harness.js';
    const { createDetector } = await import(modulePath);
    return createDetector(
      document.querySelector('iframe')!.contentDocument,
    ).scan();
  });
  expect(snapshot).toEqual({ groups: [], limited: false });
});

test('read-only, CSS-hidden and generic numeric-code fields are excluded', async ({
  page,
}) => {
  await page.locator('#single input').evaluate((input) => {
    (input as HTMLInputElement).readOnly = true;
  });
  await page.locator('#split').evaluate((group) => {
    group.style.visibility = 'hidden';
  });
  await page.locator('#ordinary input').evaluate((input) => {
    input.setAttribute('name', 'code');
  });
  await expect(page.locator('#result')).not.toContainText('single');
  await expect(page.locator('#result')).not.toContainText('split');
  await expect(page.locator('#result')).not.toContainText('ordinary');
});

test('email and authenticator ambiguity and truncated context remain uncertain', async ({
  page,
}) => {
  await page.locator('#single p').evaluate((p) => {
    p.textContent = 'Email or authenticator verification code';
  });
  await expect
    .poll(
      async () =>
        JSON.parse(await page.locator('#result').innerText()).groups[0].flow,
    )
    .toBe('uncertain');
  await page.locator('#single p').evaluate((p) => {
    p.textContent = `Email verification code ${'x'.repeat(4100)}`;
  });
  await expect(page.locator('#result')).toContainText('context-limit');
  expect(
    JSON.parse(await page.locator('#result').innerText()).groups[0].flow,
  ).toBe('uncertain');
});

test('detects a text code field on a large page and split fields in separate wrappers', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/harness.js';
    const { createDetector } = await import(modulePath);
    document.body.innerHTML =
      '<main>' +
      '<span>Background content</span>'.repeat(2500) +
      '</main><section role="dialog"><p>Enter the code we sent to person@fixture.invalid</p><input placeholder="Enter code" maxlength="6"></section>';
    const single = createDetector(document).scan();
    document.body.innerHTML =
      '<section role="dialog"><p>Check your email for a verification code</p><div>' +
      Array.from(
        { length: 6 },
        () => '<div><input maxlength="1" inputmode="numeric"></div>',
      ).join('') +
      '</div></section>';
    const split = createDetector(document).scan();
    return {
      single: single.groups.map((g: { fields: unknown[]; flow: string }) => [
        g.fields.length,
        g.flow,
      ]),
      split: split.groups.map((g: { fields: unknown[]; flow: string }) => [
        g.fields.length,
        g.flow,
      ]),
    };
  });
  expect(result).toEqual({ single: [[1, 'email']], split: [[6, 'email']] });
});
