import { test, expect } from '@playwright/test';

const animeFixture = [
  {
    id: 'anilist-102', anilistId: 102, malId: 202,
    title: 'Newer Broadcast', status: 'plan_to_watch',
    startDate: { year: 2021, month: 1, day: 1 }, endDate: { year: 2021, month: 6, day: 30 },
    addedAt: '2023-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    metadataComplete: true, cover: '', totalEpisodes: 12
  },
  {
    id: 'anilist-101', anilistId: 101, malId: 201,
    title: 'Older Broadcast', status: 'plan_to_watch',
    startDate: { year: 2002, month: 1, day: 1 }, endDate: { year: 2002, month: 6, day: 30 },
    addedAt: '2020-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    metadataComplete: true, cover: '', totalEpisodes: 12
  },
  {
    id: 'anilist-103', anilistId: 103, malId: 203,
    title: 'Recently Completed', status: 'completed',
    startDate: { year: 2018, month: 1, day: 1 }, endDate: { year: 2020, month: 1, day: 1 },
    finishDate: '2025-06-01T00:00:00.000Z', addedAt: '2018-01-02T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z', metadataComplete: true, cover: '', totalEpisodes: 12
  }
];

const mangaFixture = [
  { id: 'older-manga', title: 'Older To Read', type: 'Manga', status: 'plan_to_read', addedAt: '2020-01-01T00:00:00.000Z', updatedAt: '2021-01-01T00:00:00.000Z', chapters: [] },
  { id: 'newer-manga', title: 'Newer To Read', type: 'Manhwa', status: 'plan_to_read', addedAt: '2023-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', chapters: [] },
  { id: 'finished-manga', title: 'Finished Manga', type: 'Manga', status: 'completed', addedAt: '2019-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', chapters: [] }
];

async function stubMalSession(page, connected = false) {
  await page.route('**/api/mal/auth/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, connected, username: connected ? 'reader' : '' })
  }));
  if (connected) {
    await page.route('**/api/mal/me', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'reader', picture: '' })
    }));
    await page.route('**/api/mal/list', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] })
    }));
  }
}

test('anime library sorting orders by airing date and narrows to the plan-to-watch list', async ({ page }) => {
  await page.addInitScript(items => localStorage.setItem('folio_local_anime_v1', JSON.stringify(items)), animeFixture);
  await stubMalSession(page);
  await page.goto('/anime');

  const grid = page.locator('#localSummaryList .catalog-grid').last();
  await expect(grid.locator('.anime-list-title-link')).toHaveCount(3);
  await page.locator('#localSummaryList .hk-list-sort summary').click();
  await page.locator('#localSummaryList [data-anime-list-sort="air-oldest"]').click();
  await expect(grid.locator('.anime-list-title-link').first()).toHaveText('Older Broadcast');

  await page.locator('#localSummaryList .hk-list-sort summary').click();
  await page.locator('#localSummaryList [data-anime-list-sort="ptw-oldest"]').click();
  await expect(grid.locator('.anime-list-title-link')).toHaveCount(2);
  await expect(grid.locator('.anime-list-title-link').first()).toHaveText('Older Broadcast');
  await expect(grid.locator('.anime-list-title-link').last()).toHaveText('Newer Broadcast');
});

test('manga library sort button orders its Plan to Read shelf by oldest addition', async ({ page }) => {
  await page.addInitScript(items => localStorage.setItem('folio_manga_library_v1', JSON.stringify(items)), mangaFixture);
  await stubMalSession(page);
  await page.goto('/manga');
  await page.locator('#mangaTabs [data-tab="library"]').click();

  const grid = page.locator('#mangaGrid');
  await expect(grid.locator('.manga-list-title')).toHaveCount(3);
  await grid.locator('.hk-list-sort summary').click();
  await grid.locator('[data-manga-list-sort="ptw-oldest"]').click();
  await expect(grid.locator('.manga-list-title')).toHaveCount(2);
  await expect(grid.locator('.manga-list-title').first()).toHaveText('Older To Read');
  await expect(grid.locator('.manga-list-title').last()).toHaveText('Newer To Read');
});

test('anime catalog cards offer MAL, local, and both actions from the three-dot menu', async ({ page }) => {
  await stubMalSession(page);
  await page.route(url => url.pathname === '/api/catalog', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      anime: [{
        id: 101, idMal: 201, type: 'ANIME',
        title: { english: 'Menu Test Anime', romaji: 'Menu Test Anime' },
        coverImage: { extraLarge: 'https://cdn.example.test/menu-test.webp' },
        format: 'TV', status: 'RELEASING', averageScore: 85, genres: ['Comedy'],
        description: 'A fixture used to check the three-dot collection menu.'
      }],
      manga: [], airing: [], seasonal: [], seasonalTotal: 0, airingTotal: 0,
      animeTotal: 1, mangaTotal: 0, season: 'WINTER', seasonYear: 2026
    })
  }));
  await page.route('https://cdn.example.test/**', route => route.fulfill({
    status: 200, contentType: 'image/webp', body: Buffer.from([])
  }));

  await page.goto('/discover');
  const menu = page.locator('#animeCatalogGrid .catalog-action-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('summary').click();
  await expect(menu.locator('[data-catalog-action="local"]')).toContainText('Add to local');
  await expect(menu.locator('[data-catalog-action="mal"]')).toContainText('Add to MAL');
  await expect(menu.locator('[data-catalog-action="both"]')).toContainText('Add to both');

  await menu.locator('[data-catalog-action="local"]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('folio_local_anime_v1') || '[]')
    .some(item => item.title === 'Menu Test Anime'))).toBe(true);
});
