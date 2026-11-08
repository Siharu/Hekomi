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
        id: 'pid-1', tid: 1001, anilistId: 1001, malId: 1001, title: watchedTitle, shortTitle: 'Sousou no Frieren',
        cover: 'https://cdn.example.test/frieren-catalog.webp',
        date, time: '20:00', airingAt: date + 'T11:00:00.000Z',
        episode: 1, status: 'upcoming', listingType: 'TV', channel: 'TOKYO MX',
        url: 'https://anilist.co/anime/1001'
      },
      {
        id: 'pid-2', tid: 1002, anilistId: 1002, malId: 1002, title: 'Spy x Family',
        cover: 'https://cdn.example.test/spy-catalog.webp',
        date, time: '21:00', airingAt: date + 'T12:00:00.000Z',
        episode: 2, status: 'upcoming', listingType: 'TV', channel: 'TV Tokyo',
        url: 'https://anilist.co/anime/1002'
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
  await page.goto('/calendar');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.locator('#hkCalWeekTotal')).not.toContainText('UPDATING');
}


test('weekly schedule has its own Calendar page and does not load on Home', async ({ page }) => {
  let calendarRequests = 0;
  await page.route(url => url.pathname === '/api/calendar', route => {
    calendarRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scheduleFixture())
    });
  });

  await page.goto('/');
  await expect(page.locator('#calendarView')).toBeHidden();
  await expect(page.locator('#hkCalendar')).toBeHidden();
  expect(calendarRequests).toBe(0);

  await page.locator('.primary-nav [data-route-link="calendar"]').click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.locator('#calendarView')).toBeVisible();
  await expect(page.locator('#hkCalendar')).toBeVisible();
  await expect.poll(() => calendarRequests).toBe(1);
  await expect(page.locator('#hkCalWeekTotal')).not.toContainText('UPDATING');
});

test('local AniList-backed watching entry overrides only its matching calendar poster', async ({ page }) => {
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
  const events = page.locator('.hk-week-event');
  await expect(events).toHaveCount(2);
  const frieren = events.filter({ hasText: watchedTitle });
  const spy = events.filter({ hasText: 'Spy x Family' });
  await expect(frieren).toHaveAttribute('data-watching', 'true');
  await expect(frieren.locator('.hk-week-event-cover')).toHaveAttribute('src', localCover);
  await expect(spy).not.toHaveAttribute('data-watching', 'true');
  await expect(spy.locator('.hk-week-event-cover')).toHaveAttribute('src', 'https://cdn.example.test/spy-catalog.webp');
  await expect(page.locator('.hk-week-day-card[data-date="' + todayInTokyo() + '"] .hk-week-event')).toHaveCount(2);
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

  await page.goto('/calendar');
  await page.waitForResponse(response => response.url().includes('/api/calendar'));
  const frieren = page.locator('.hk-week-event').filter({ hasText: watchedTitle });
  await expect(frieren).toHaveAttribute('data-watching', 'true');
  await expect(frieren.locator('.hk-week-event-cover')).toHaveAttribute('src', malCover);
  await expect(frieren.locator('.hk-week-watch-tag')).toContainText('IN YOUR WATCHLIST');
});

test('calendar omits Japanese-only and posterless broadcast rows', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('folio_local_anime_v1', '[]'));
  await mockCalendar(page);
  await page.route(url => url.pathname === '/api/calendar', route => {
    const fixture = scheduleFixture();
    fixture.rawProgramCount = 3;
    fixture.programs.push({
      id: 'pid-japanese', title: '薬屋のひとりごと', titleUnavailable: false,
      date: todayInTokyo(), time: '22:00', airingAt: todayInTokyo() + 'T13:00:00.000Z',
      episode: 1, status: 'upcoming', listingType: 'TV', url: 'https://cal.syoboi.jp/'
    });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
  });
  await page.route(url => url.pathname === '/api/mal/list', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  );
  await openCalendar(page);
  await expect(page.locator('.hk-week-event')).toHaveCount(2);
  await expect(page.locator('.hk-week-event').filter({ hasText: '薬屋のひとりごと' })).toHaveCount(0);
  await expect(page.locator('.hk-week-event-cover')).toHaveCount(2);
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

  await page.goto('/calendar');
  await page.waitForResponse(response => response.url().includes('/api/calendar'));
  await expect(page.locator('.hk-week-event-cover')).toBeVisible();
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
  const entry = page.locator('.hk-week-event').filter({ hasText: 'My personal series alias' });
  await expect(entry).toHaveAttribute('data-watching', 'true');
  await expect(entry.locator('.hk-week-event-cover')).toHaveAttribute('src', localCover);
});
