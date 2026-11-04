import { test, expect } from '@playwright/test';

const mobileRoutes = ['/', '/discover', '/anime', '/manga', '/profile'];

for (const route of mobileRoutes) {
  test(`mobile navigation and floating controls stay clear on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(route);
    await expect(page.locator('.primary-nav')).toBeVisible();
    await expect(page.locator('#hekomiCompanion')).toBeAttached();
    await expect(page.locator('.hk-core-launch')).toBeVisible();

    const layout = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const viewportHeight = window.visualViewport?.height || document.documentElement.clientHeight;
      const viewportWidth = document.documentElement.clientWidth;
      return {
        viewportWidth,
        viewportHeight,
        documentWidth: document.documentElement.scrollWidth,
        nav: rect('.primary-nav'),
        header: rect('.topbar'),
        chat: rect('.hk-core-launch'),
        companion: rect('#hekomiCompanion'),
        headerTransform: getComputedStyle(document.querySelector('.topbar')).transform,
        headerAnimation: getComputedStyle(document.querySelector('.topbar')).animationName,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.nav.left).toBeGreaterThanOrEqual(0);
    expect(layout.nav.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.nav.top).toBeGreaterThan(layout.viewportHeight * 0.72);
    expect(layout.nav.bottom).toBeLessThanOrEqual(layout.viewportHeight - 4);
    expect(layout.header.bottom).toBeLessThan(80);
    expect(layout.headerTransform).toBe('none');
    expect(layout.headerAnimation).toBe('none');
    expect(layout.chat.bottom).toBeLessThan(layout.nav.top - 4);
    expect(layout.companion.bottom).toBeLessThan(layout.nav.top - 4);
    expect(pageErrors).toEqual([]);
  });
}

test('mobile chat panel opens above the bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /talk to hekomi-chan/i }).click();
  const nav = await page.locator('.primary-nav').boundingBox();
  const panel = await page.locator('.hk-core-panel.open').boundingBox();
  expect(panel).not.toBeNull();
  expect(panel.y + panel.height).toBeLessThan(nav.y - 4);
});

test('desktop keeps its horizontal header navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const navPosition = await page.locator('.primary-nav').evaluate(element => getComputedStyle(element).position);
  expect(navPosition).not.toBe('fixed');
});

test('mobile shell adapts to compact and wide phone widths', async ({ page }) => {
  for (const width of [360, 375, 430]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto('/manga');
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      };
      return {
        width: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportHeight: window.visualViewport?.height || document.documentElement.clientHeight,
        nav: rect('.primary-nav'),
        chat: rect('.hk-core-launch'),
        brand: rect('.brand'),
        actions: rect('.top-actions'),
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.width + 1);
    expect(layout.nav.left).toBeGreaterThanOrEqual(0);
    expect(layout.nav.right).toBeLessThanOrEqual(width + 1);
    expect(layout.nav.top).toBeGreaterThan(layout.viewportHeight * .72);
    expect(layout.nav.bottom).toBeLessThanOrEqual(layout.viewportHeight - 4);
    expect(layout.chat.bottom).toBeLessThan(layout.nav.top - 4);
    expect(layout.brand.right).toBeLessThanOrEqual(layout.actions.left + 1);
  }
});
