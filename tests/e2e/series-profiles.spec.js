import { test, expect } from '@playwright/test';

async function stubMalAuth(page) {
  await page.route('**/api/mal/auth/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false, connected: false, username: '' })
  }));
}

const animeProfile = {
  id: 1,
  idMal: 1,
  type: 'ANIME',
  title: 'Cowboy Bebop',
  titleEnglish: 'Cowboy Bebop',
  titleRomaji: 'Cowboy Bebop',
  cover: 'https://cdn.example.test/cowboy.webp',
  description: 'A crew travels across the solar system.',
  genres: ['Action', 'Sci-Fi'],
  format: 'TV',
  status: 'FINISHED',
  episodes: 26,
  averageScore: 86,
  studios: ['Sunrise'],
  characters: [{
    id: 1,
    name: 'Spike Spiegel',
    image: 'https://cdn.example.test/spike.webp',
    siteUrl: 'https://anilist.co/character/1',
    role: 'MAIN',
    japaneseVoiceActors: [{
      id: 100, name: 'Kouichi Yamadera', language: 'Japanese',
      image: 'https://cdn.example.test/yamadera.webp',
      siteUrl: 'https://anilist.co/staff/100'
    }],
    englishVoiceActors: [{
      id: 101, name: 'Steve Blum', language: 'English',
      image: 'https://cdn.example.test/blum.webp',
      siteUrl: 'https://anilist.co/staff/101'
    }]
  }],
  staff: [{
    id: 102,
    name: 'Shinichiro Watanabe',
    image: 'https://cdn.example.test/watanabe.webp',
    siteUrl: 'https://anilist.co/staff/102',
    role: 'Director'
  }],
  authors: [],
  artists: [],
  relations: []
};

const mangaProfile = {
  id: 30013,
  idMal: 13,
  type: 'MANGA',
  title: 'One Piece',
  titleEnglish: 'One Piece',
  titleRomaji: 'One Piece',
  cover: 'https://cdn.example.test/one-piece.webp',
  description: 'A pirate adventure.',
  genres: ['Action', 'Adventure'],
  format: 'MANGA',
  status: 'RELEASING',
  chapters: 1000,
  volumes: 100,
  authors: [{
    id: 200,
    name: 'Eiichiro Oda',
    image: 'https://cdn.example.test/oda.webp',
    siteUrl: 'https://anilist.co/staff/200',
    role: 'Story & Art'
  }],
  artists: [{
    id: 200,
    name: 'Eiichiro Oda',
    image: 'https://cdn.example.test/oda.webp',
    siteUrl: 'https://anilist.co/staff/200',
    role: 'Story & Art'
  }],
  characters: [{
    id: 201,
    name: 'Monkey D. Luffy',
    image: 'https://cdn.example.test/luffy.webp',
    siteUrl: 'https://anilist.co/character/201',
    role: 'MAIN'
  }],
  staff: [],
  relations: []
};

test('anime detail modal shows characters, Japanese and English voice actors, and staff', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('folio_local_anime_v1', JSON.stringify([{
      id: 'local-cowboy-profile',
      anilistId: 1,
      malId: 1,
      title: 'Cowboy Bebop',
      status: 'plan_to_watch',
      episodes: 0,
      score: 0,
      cover: animeProfileCover,
      metadataComplete: true
    }]));
  }, { animeProfileCover: animeProfile.cover });

  await stubMalAuth(page);
  await page.route(url => url.pathname === '/api/catalog/detail', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(animeProfile)
    })
  );
  await page.route('https://cdn.example.test/**', route => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: Buffer.from([])
  }));

  await page.goto('/anime');
  await page.locator('[data-local-details="local-cowboy-profile"]').first().click();

  const credits = page.locator('#animeSeriesCredits');
  await expect(credits).toContainText('Spike Spiegel');
  await expect(credits).toContainText('Kouichi Yamadera');
  await expect(credits).toContainText('Steve Blum');
  await expect(credits).toContainText('Production staff');
  await expect(credits).toContainText('Shinichiro Watanabe');
});

test('MangaDex-style manga library entry can hydrate AniList authors, artists, and characters', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('folio_manga_library_v1', JSON.stringify([{
      id: 'mangadex-one-piece',
      title: 'One Piece',
      type: 'Manga',
      source: 'MangaDex',
      description: 'An imported local entry.',
      cover: 'https://cdn.example.test/one-piece.webp',
      authors: ['Eiichiro Oda'],
      artists: ['Eiichiro Oda'],
      chapters: [],
      status: 'reading'
    }]));
  });

  await stubMalAuth(page);
  await page.route(url => url.pathname === '/api/catalog/profile-search', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ id: 30013, title: 'One Piece', type: 'MANGA' }] })
    })
  );
  await page.route(url => url.pathname === '/api/catalog/detail', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mangaProfile)
    })
  );
  await page.route('https://cdn.example.test/**', route => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: Buffer.from([])
  }));

  await page.goto('/manga');
  await page.locator('#mangaTabs [data-tab="library"]').click();
  await page.locator('[data-manga-detail="mangadex-one-piece"]').first().click();

  const credits = page.locator('#mangaSeriesCredits');
  await expect(credits).toContainText('Authors & story');
  await expect(credits).toContainText('Eiichiro Oda');
  await expect(credits).toContainText('Artists & illustration');
  await expect(credits).toContainText('Characters');
  await expect(credits).toContainText('Monkey D. Luffy');
});
