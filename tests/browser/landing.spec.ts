import { expect, test } from '@playwright/test';
for (const width of [1440, 768, 380]) {
  test(`public landing explains features and leads to signup at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3100');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Email codes, with less friction.',
    );
    await expect(
      page.getByText(
        'Currently available as a Canva pilot. More sites are planned.',
      ),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Explore features →' }).click();
    await expect(
      page.getByRole('heading', { name: 'A simpler verification flow' }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Get started', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(
      page.getByRole('heading', { name: 'Create your OTPGuard account' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to home' }).click();
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
}
