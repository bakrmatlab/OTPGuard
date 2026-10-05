import { expect, test } from '@playwright/test';
for (const width of [1440, 768, 380]) {
  test(`workspace switches useful views without exposing inactive cloud data at ${width}px`, async ({
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
    await page.goto('http://127.0.0.1:3100/dashboard');
    await expect(page).toHaveTitle('OTPGuard · Account & security');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Overview',
    );
    await expect(
      page.getByText('1 pilot service', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('#connections')).not.toBeVisible();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to dashboard' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    const navigation = page.getByRole('navigation', { name: 'Dashboard' });
    for (const [name, id] of [
      ['Account & connections', 'connections'],
      ['Activity', 'activity'],
      ['Settings', 'settings'],
      ['Supported sites', 'services'],
      ['Overview', 'overview'],
    ] as const) {
      const link = navigation.getByRole('link', { name, exact: true });
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).toBeFocused();
      await expect(page.locator(`#${id}`)).toBeInViewport();
      for (const other of [
        'overview',
        'connections',
        'activity',
        'settings',
        'services',
      ])
        if (other !== id)
          await expect(page.locator(`#${other}`)).not.toBeVisible();
    }
    await page
      .getByRole('link', { name: 'Manage account', exact: true })
      .click();
    await expect(
      page.getByText('Account authentication is unconfigured.'),
    ).toBeVisible();
    await page.getByText('Device reports', { exact: true }).click();
    await expect(
      page.getByText('Device reports unavailable', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('No synchronized connection report available.', {
        exact: false,
      }),
    ).toBeVisible();
    await navigation
      .getByRole('link', { name: 'Activity', exact: true })
      .click();
    await expect(
      page.getByText(
        'The dashboard cannot read unsynchronized extension-local activity.',
        { exact: false },
      ),
    ).toBeVisible();
    await page.getByText('Cloud history availability', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Enable cloud history' }),
    ).toBeDisabled();
    await page.reload();
    await expect(
      navigation.getByRole('link', { name: 'Activity', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#activity')).toBeVisible();
    await navigation
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await page
      .getByText('Cloud settings availability', { exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Enable sync', exact: true }),
    ).toBeDisabled();
    await page.goBack();
    await expect(page.locator('#activity')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('input, textarea, iframe')).toHaveCount(0);
    expect(
      await page
        .locator('body')
        .evaluate((body) => body.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
