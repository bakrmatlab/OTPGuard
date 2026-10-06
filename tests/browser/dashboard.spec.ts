import { expect, test } from '@playwright/test';
for (const width of [1440, 768, 375]) {
  test(`dark workspace states stay honest and navigable at ${width}px`, async ({
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Browser settings',
    );
    await expect(
      page.getByText('Account authentication is unconfigured.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Connect Gmail', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Reconnect Gmail', exact: true }),
    ).toBeDisabled();
    const navigation = page.getByRole('navigation', { name: 'Dashboard' });
    for (const [name, id] of [
      ['Activity', 'activity'],
      ['Preferences', 'settings'],
      ['Browser settings', 'connections'],
    ] as const) {
      const link = navigation.getByRole('link', { name, exact: true });
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).toBeFocused();
      for (const other of ['connections', 'activity', 'settings'])
        if (other !== id)
          await expect(page.locator(`#${other}`)).not.toBeVisible();
    }
    await navigation
      .getByRole('link', { name: 'Activity', exact: true })
      .click();
    await expect(
      page.getByText('Connect this browser to view local activity.', {
        exact: false,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      navigation.getByRole('link', { name: 'Activity', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
