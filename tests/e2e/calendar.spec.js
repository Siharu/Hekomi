import { test, expect } from '@playwright/test';

function todayInTokyo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value || '01';
  return part('year') + '-' + part('month') + '-' + part('day');
}

const watchedTitle = 'Frieren: Beyond Journey’s End';
const localCover = 'https://cdn.example.test/frieren-local.webp';
const malCover = 'https://cdn.example.test/frieren-mal.webp';

function scheduleFixture() {
  const date = todayInTokyo();
  return {
    start: date.slice(0, 7) + '-01',
    days: 31,
    rawProgramCount: 2,
    titleCount: 0,
    source: 'Syoboi Calendar + RSS2 fallback',
    timezone: 'Asia/Tokyo',
    programs: [
      {
        id: 'pid-1', tid: 1001, title: watchedTitle, shortTitle: 'Sousou no Frieren',
        date, time: '20:00', airingAt: date + 'T11:00:00.000Z',
        episode: 1, status: 'upcoming', listingType: 'TV', channel: 'TOKYO MX',
        url: 'https://cal.syoboi.jp/tid/1001'
      },
      {
        id: 'pid-2', tid: 1002, title: 'Spy x Family',
        date, time: '21:00', airingAt: date + 'T12:00:00.000Z',
        episode: 2, status: 'upcoming', listingType: 'TV', channel: 'TV Tokyo',
        url: 'https://cal.syoboi.jp/tid/1002'
      }
    ]
  };
}

async function mockCalendar(page) {
  await page.route(url => url.pathname === '/api/calendar', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scheduleFixture()) })
  );
  await page.route(url => url.hostname === 'cdn.example.test', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64') })
  );
}
async function openCalendar(page) {
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/calendar');
  await page.goto('/');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.locator('#hkCalMonthTotal')).not.toContainText('UPDATING');
}

test('local AniList-backed watching entry adds its cover to the matching broadcast only', async ({ page }) => {
  await page.addInitScript(({ cover }) => {
    localStorage.setItem('folio_local_anime_v1', JSON.stringify([
      {
        id: 'anilist-1001',
        title: 'Sousou no Frieren',
        titleEnglish: 'Frieren: Beyond Journey’s End',
        status: 'watching',
        cover
      },
      {
        id: 'anilist-1002',
        title: 'Spy x Family',
        status: 'plan_to_watch',
        cover: 'https://cdn.example.test/spy.webp'
      }
    ]));
  }, { cover: localCover });
  await mockCalendar(page);
  await page.route(url => url.pathname === '/api/mal/list', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Sign in first.' }) })
  );

  await openCalendar(page);
  const events = page.locator('.hk-cal-event');
  await expect(events).toHaveCount(2);
  const frieren = events.filter({ hasText: watchedTitle });
  const spy = events.filter({ hasText: 'Spy x Family' });
  await expect(frieren).toHaveAttribute('data-watching', 'true');
  await expect(frieren.locator('.hk-cal-event-cover')).toHaveAttribute('src', localCover);
  await expect(spy).not.toHaveAttribute('data-watching', 'true');
  await expect(spy.locator('.hk-cal-event-cover')).toHaveCount(0);
});

test('signed-in MAL watching entry supplies a poster when no local copy exists', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('folio_local_anime_v1', '[]'));
  await mockCalendar(page);
  await page.route(url => url.pathname === '/api/mal/list', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          node: {
            id: 1001,
            title: watchedTitle,
            alternative_titles: { en: watchedTitle, ja: '葬送のフリーレン' },
            main_picture: { large: malCover }
          },
          list_status: { status: 'watching', num_episodes_watched: 4 }
        }]
      })
    })
  );

  await page.goto('/');
  await page.waitForResponse(response => response.url().includes('/api/calendar'));
  const frieren = page.locator('.hk-cal-event').filter({ hasText: watchedTitle });
  await expect(frieren).toHaveAttribute('data-watching', 'true');
  await expect(frieren.locator('.hk-cal-event-cover')).toHaveAttribute('src', malCover);
  await expect(frieren.locator('.hk-cal-event-watch-tag')).toContainText('IN YOUR WATCHLIST');
});

test('calendar cards remain within the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(({ cover }) => {
    localStorage.setItem('folio_local_anime_v1', JSON.stringify([{
      id: 'anilist-1001', title: 'Sousou no Frieren',
      titleEnglish: 'Frieren: Beyond Journey’s End', status: 'watching', cover
    }]));
  }, { cover: localCover });
  await mockCalendar(page);
  await page.route('**/api/mal/list', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  );

  await page.goto('/');
  await page.waitForResponse(response => response.url().includes('/api/calendar'));
  await expect(page.locator('.hk-cal-event-cover')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('AniList ID fallback displays a watched series title and cover when source titles are missing', async ({ page }) => {
  await page.addInitScript(({ cover }) => {
    localStorage.setItem('folio_local_anime_v1', JSON.stringify([{
      id: 'anilist-777',
      anilistId: 777,
      title: 'My personal series alias',
      status: 'watching',
      cover
    }]));
  }, { cover: localCover });
  await page.route(url => url.pathname === '/api/calendar', route => {
    const fixture = scheduleFixture();
    fixture.programs[0] = {
      ...fixture.programs[0],
      title: 'Anime broadcast #777',
      titleUnavailable: true,
      anilistId: 777,
      malId: 888
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture)
    });
  });
  await page.route(url => url.pathname === '/api/mal/list', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  );
  await page.route(url => url.hostname === 'cdn.example.test', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64') })
  );

  await openCalendar(page);
  const entry = page.locator('.hk-cal-event').filter({ hasText: 'My personal series alias' });
  await expect(entry).toHaveAttribute('data-watching', 'true');
  await expect(entry.locator('.hk-cal-event-cover')).toHaveAttribute('src', localCover);
});


test('Japanese broadcast title shows AniList artwork and opens the Hekomi anime profile', async ({ page }) => {
  const date = todayInTokyo();
  const cover = 'https://cdn.example.test/anime-cover.webp';
  await page.route(url => url.pathname === '/api/calendar', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      start: date.slice(0, 7) + '-01',
      days: 31,
      rawProgramCount: 1,
      timezone: 'Asia/Tokyo',
      programs: [{
        id: 'pid-jp-1',
        tid: 777,
        title: 'Frieren: Beyond Journey’s End',
        sourceTitle: '葬送のフリーレン',
        shortTitle: 'Sousou no Frieren',
        anilistId: 777,
        malId: 888,
        cover,
        animeUrl: '/series/anime/777-frieren-beyond-journey-s-end',
        date,
        time: '20:00',
        airingAt: date + 'T11:00:00.000Z',
        episode: 5,
        status: 'upcoming',
        listingType: 'TV',
        channel: 'TOKYO MX'
      }]
    })
  }));
  await page.route(url => url.hostname === 'cdn.example.test', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64') })
  );
  await page.route(url => url.pathname === '/api/mal/list', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  );

  await openCalendar(page);
  const event = page.locator('.hk-cal-event').filter({ hasText: 'Frieren: Beyond Journey’s End' });
  await expect(event.locator('.hk-cal-event-cover')).toHaveAttribute('src', cover);
  await expect(event.locator('h4 a')).toHaveAttribute('href', '/series/anime/777-frieren-beyond-journey-s-end');
  await expect(event.locator('.hk-cal-event-cover-link')).toHaveAttribute('href', '/series/anime/777-frieren-beyond-journey-s-end');
});
