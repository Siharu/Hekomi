import { test, expect } from '@playwright/test';

test('Hekomi landing workspace renders its primary choices', async ({ page }) => {
  const uncaughtErrors = [];
  page.on('pageerror', error => uncaughtErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/Hekomi/i);
  await expect(page.getByText('Choose what you\'re here for.')).toBeVisible();
  await expect(page.getByText('MAL Client', { exact: true })).toBeVisible();
  await expect(page.getByText('Manga Library', { exact: true })).toBeVisible();

  // Keep this as a baseline regression guard while React is introduced in islands.
  await expect(page.locator('#hekomiChanCanvas')).toBeAttached();
  expect(uncaughtErrors).toEqual([]);
});

test('landing page fits the mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});