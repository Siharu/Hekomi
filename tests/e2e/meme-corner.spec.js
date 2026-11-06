import { test, expect } from '@playwright/test';

const pixel = Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64');

function memeBatch(title, postId) {
  return {
    count: 3,
    memes: [
      { nsfw: true, spoiler: false, subreddit: 'Animemes', title: 'Skip NSFW', url: 'https://i.redd.it/unsafe.jpg', postLink: 'https://redd.it/unsafe', ups: 99, preview: ['https://preview.redd.it/unsafe.jpg?width=640'] },
      { nsfw: false, spoiler: true, subreddit: 'Animemes', title: 'Skip spoilers', url: 'https://i.redd.it/spoiler.jpg', postLink: 'https://redd.it/spoiler', ups: 88, preview: ['https://preview.redd.it/spoiler.jpg?width=640'] },
      { nsfw: false, spoiler: false, subreddit: 'Animemes', title, url: 'https://i.redd.it/safe.jpg', postLink: 'https://redd.it/' + postId, ups: 123, preview: ['https://preview.redd.it/safe.jpg?width=640'] }
    ]
  };
}

test('meme corner only renders unflagged anime memes and refreshes on demand', async ({ page }) => {
  let calls = 0;
  await page.route('https://meme-api.com/**', async route => {
    calls += 1;
    const title = calls === 1 ? 'Anime fans at 2 AM' : 'One more episode, surely';
    const postId = calls === 1 ? 'safe-one' : 'safe-two';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(memeBatch(title, postId)) });
  });
  await page.route('https://preview.redd.it/**', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: pixel })
  );

  await page.goto('/');
  await page.locator('#hkMemeCorner').scrollIntoViewIfNeeded();
  await expect(page.locator('#hkMemeCaption')).toHaveText('Anime fans at 2 AM');
  await expect(page.locator('#hkMemeSource')).toHaveAttribute('href', 'https://redd.it/safe-one');
  await expect(page.locator('#hkMemeSubreddit')).toHaveText('R/Animemes');
  expect(calls).toBe(1);

  await page.locator('#hkMemeNext').click();
  await expect(page.locator('#hkMemeCaption')).toHaveText('One more episode, surely');
  await expect(page.locator('#hkMemeSource')).toHaveAttribute('href', 'https://redd.it/safe-two');
  expect(calls).toBe(2);
});

test('meme corner stays within a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('https://meme-api.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(memeBatch('Mobile meme', 'mobile-safe')) })
  );
  await page.route('https://preview.redd.it/**', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: pixel })
  );

  await page.goto('/');
  await page.locator('#hkMemeCorner').scrollIntoViewIfNeeded();
  await expect(page.locator('#hkMemeCaption')).toHaveText('Mobile meme');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
