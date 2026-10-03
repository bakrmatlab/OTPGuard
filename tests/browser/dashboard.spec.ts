import { expect, test } from '@playwright/test';

for (const width of [1440, 768, 380]) {
  test(`dashboard has accessible honest states at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', (error) => errors.push(error.name));
    page.on('request', (request) => {
      if (new URL(request.url()).hostname !== '127.0.0.1')
        external.push(new URL(request.url()).origin);
    });
    await page.goto('http://127.0.0.1:3100');
    await expect(page).toHaveTitle('OTPGuard · Account & security');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Your protection workspace',
    );
    for (const name of [
      'Connected accounts',
      'Activity',
      'Devices',
      'Settings',
      'Supported services & origins',
    ] as const) {
      await expect(
        page.getByRole('region', { name, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByText('Device reports unavailable', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('No synchronized connection report available.', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('No real services validated yet'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'The dashboard cannot read unsynchronized extension-local activity.',
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enable cloud history' }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Enable sync', exact: true }),
    ).toBeDisabled();
    await expect(page.locator('input, textarea, iframe')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to dashboard' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    const navigation = page.getByRole('navigation', { name: 'Dashboard' });
    for (const [name, id] of [
      ['Overview', 'overview'],
      ['Connected accounts', 'connections'],
      ['Activity', 'activity'],
      ['Devices', 'devices'],
      ['Settings', 'settings'],
      ['Supported services', 'services'],
    ] as const) {
      await navigation.getByRole('link', { name, exact: false }).click();
      await expect(page).toHaveURL(`http://127.0.0.1:3100/#${id}`);
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    expect(
      await page
        .locator('body')
        .evaluate((body) => body.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
