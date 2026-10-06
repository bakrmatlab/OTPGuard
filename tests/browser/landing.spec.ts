import { expect, test } from '@playwright/test';
for (const width of [1440, 768, 375]) {
  test(`dark homepage demonstrates explicit Fill at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3100');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Find the code.Choose Fill.',
    );
    await expect(page.locator('#demo-code')).toHaveValue('');
    await page.getByRole('link', { name: 'Try the demo' }).click();
    await page.getByRole('button', { name: 'Fill', exact: true }).click();
    await expect(page.locator('#demo-code')).toHaveValue('047291');
    await expect(page.getByRole('status')).toContainText(
      'Nothing was submitted.',
    );
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await expect(page.locator('#demo-code')).toHaveValue('');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('body')
        .evaluate((body) => getComputedStyle(body).backgroundColor),
    ).toBe('rgb(8, 11, 11)');
    await page.getByRole('link', { name: 'Install for Chrome' }).click();
    await expect(page).toHaveURL(/\/install/);
    await expect(
      page.getByRole('heading', { name: 'Coming soon.', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Public store installation is not available yet.', {
        exact: false,
      }),
    ).toBeHidden();
    await page.getByText('Local installation steps', { exact: true }).click();
    await expect(
      page.getByText('Public store installation is not available yet.', {
        exact: false,
      }),
    ).toBeVisible();
  });
}
