import { test, expect } from '@playwright/test';

async function openHekomiWithAiringFixture(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/api/calendar*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      start: '2026-11-01',
      days: 30,
      programs: [],
      total: 0,
      timezone: 'Asia/Tokyo'
    })
  }));
  await page.route('**/api/catalog*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      airing: [{
        id: 777,
        title: 'Airing Test Series',
        titleEnglish: 'Airing Test Series',
        titleRomaji: 'Airing Test Series',
        cover: 'https://cdn.example.test/airing-test.webp',
        nextAiringEpisode: {
          episode: 4,
          airingAt: Math.floor(Date.now() / 1000) + 3600
        }
      }]
    })
  }));
  await page.route('**/api/mal/list*', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Sign in first.' })
  }));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.hekomiChan))).toBe(true);
  await expect(page.locator('#hekomiCompanion canvas.home-mascot')).toBeVisible();
}

test('scrolling no longer rapidly replaces Hekomi-chan dialogue', async ({ page }) => {
  await openHekomiWithAiringFixture(page);

  await page.evaluate(() => {
    const companion = window.hekomiChan;
    companion.say('Please let me finish this thought.', 8000, true);
    for (let i = 0; i < 24; i++) companion.onScroll();
  });
  await page.waitForTimeout(1200);

  await expect(page.locator('#hekomiChanMessage')).toHaveText('Please let me finish this thought.');
});

test('Hekomi-chan makes her bed before sleeping and can switch to an eating activity', async ({ page }) => {
  await openHekomiWithAiringFixture(page);

  await page.evaluate(() => window.hekomiChan.startBedtime(performance.now()));
  await expect(page.locator('#hekomiCompanion')).toHaveClass(/is-making-bed/);
  await expect(page.locator('#hekomiCompanion .hekomi-bed')).toBeVisible();

  await expect.poll(() => page.locator('#hekomiCompanion').evaluate(node => node.classList.contains('is-sleeping')), {
    timeout: 5000
  }).toBe(true);
  await expect(page.locator('#hekomiCompanion .hekomi-zzz')).toBeVisible();

  await page.evaluate(() => window.hekomiChan.startEating(performance.now()));
  await expect(page.locator('#hekomiCompanion')).toHaveClass(/is-eating/);
  await expect(page.locator('#hekomiCompanion .hekomi-snack')).toBeVisible();
});

test('airing recommendation links to the Hekomi anime profile', async ({ page }) => {
  await openHekomiWithAiringFixture(page);

  await page.evaluate(() => window.hekomiChan.recommendAiring(performance.now()));
  const recommendation = page.locator('#hekomiCompanion .hekomi-recommend-link');
  await expect(recommendation).toBeVisible({ timeout: 5000 });
  await expect(recommendation).toHaveAttribute('href', '/series/anime/777-airing-test-series');
  await expect(recommendation).toContainText('Airing Test Series');
});

test('Hekomi-chan can perch on an anime profile cover', async ({ page }) => {
  await openHekomiWithAiringFixture(page);

  const result = await page.evaluate(() => {
    const cover = document.createElement('img');
    cover.className = 'detail-cover';
    cover.alt = 'Example anime poster';
    cover.style.cssText = 'position:fixed;left:90px;top:180px;width:230px;height:345px;object-fit:cover';
    document.body.appendChild(cover);
    history.replaceState({}, '', '/series/anime/777-airing-test-series');
    const companion = window.hekomiChan;
    const target = companion.findPerchTarget();
    companion.nextPose = 'perch';
    companion.arrive();
    return {
      target,
      perched: document.getElementById('hekomiCompanion').classList.contains('is-perching')
    };
  });

  expect(result.target).not.toBeNull();
  expect(result.perched).toBe(true);
});
