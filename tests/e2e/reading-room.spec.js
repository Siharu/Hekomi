import { test, expect } from '@playwright/test';

test('Reading Room code remains intact when server modules are appended', async ({ page }) => {
  const uncaughtErrors = [];
  const moduleResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/assets/hekomi-core.mjs'
  );
  page.on('pageerror', error => uncaughtErrors.push(error.message));

  await page.goto('/manga');
  await expect(page.locator('#mangaGrid')).toBeAttached();
  const moduleResponse = await moduleResponsePromise;
  expect(moduleResponse.status()).toBe(200);
  expect(moduleResponse.headers()['content-type']).toMatch(/javascript/i);
  await expect.poll(() => page.evaluate(() => window.__hekomiCoreMounted === true)).toBe(true);

  const scriptLayout = await page.evaluate(() => {
    const scripts = Array.from(document.scripts);
    const app = scripts.find(script => !script.src && script.textContent.includes('function openChapterReader'));
    const companion = scripts.find(script => script.src.includes('/assets/hekomi-core-ui.js'));
    return {
      appScriptPresent: Boolean(app),
      readerAndPageImageCodePresent: Boolean(app && app.textContent.includes('function openChapterReader') && app.textContent.includes('function readChapter')),
      companionScriptIsSeparateAndAfterApp: Boolean(app && companion && scripts.indexOf(companion) > scripts.indexOf(app)),
      companionMarkupWasNotInjectedIntoAppCode: Boolean(app && !app.textContent.includes('<script type="module" src="/assets/hekomi-core-ui.js">')),
    };
  });

  expect(scriptLayout).toEqual({
    appScriptPresent: true,
    readerAndPageImageCodePresent: true,
    companionScriptIsSeparateAndAfterApp: true,
    companionMarkupWasNotInjectedIntoAppCode: true,
  });
  expect(uncaughtErrors).toEqual([]);
});
