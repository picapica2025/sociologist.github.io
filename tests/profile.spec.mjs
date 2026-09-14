import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function expectUnclippedText(locator) {
  expect(await locator.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const lines = new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top)));
    return text.width <= box.width + 1 && text.left >= box.left - 1 && text.right <= window.innerWidth + 1
      && lines.size === 1;
  })).toBe(true);
}

for (const width of [1440, 1280, 390, 320]) {
  test(`layout and all seven disclosures at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const cards = page.locator('.profile-card');
    await expect(cards).toHaveCount(7);
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectUnclippedText(page.locator('#profile-title'));
    await expectUnclippedText(page.locator('#contact-title'));
    expect(await page.locator('#contact-title').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12.5);
    for (let i = 0; i < 7; i++) {
      const card = cards.nth(i);
      await card.locator('summary').click();
      await expect(page.locator('.profile-card[open]')).toHaveCount(1);
      await expect(card).toHaveAttribute('open', '');
      expect(await card.locator('.card-details li').evaluateAll(items => items.length > 0 && items.every(el => el.checkVisibility()))).toBe(true);
      await expect(card.locator('.card-details')).toHaveCSS('opacity', '1');
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`), fullPage: true });
  });
}

test('fade animations settle and reverse without a stale closing timer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cards = page.locator('.profile-card');
  for (let i = 0; i < 7; i++) {
    const card = cards.nth(i);
    await card.locator('summary').click();
    await expect(page.locator('.profile-card[open]')).toHaveCount(1);
    await expect(card.locator('.card-details')).toHaveCSS('opacity', '1');
    await expect(card).not.toHaveClass(/is-opening|is-closing/);
  }
  const sixth = cards.nth(5);
  await sixth.locator('summary').click();
  await expect(sixth.locator('.card-details')).toHaveCSS('opacity', '1');
  await sixth.locator('summary').click();
  await expect(sixth).toHaveClass(/is-closing/);
  // dispatchEvent deliberately avoids waiting for animated geometry to settle.
  await sixth.locator('summary').dispatchEvent('click');
  await expect(sixth).not.toHaveClass(/is-closing/);
  await expect(sixth.locator('.card-details')).toHaveCSS('opacity', '1');
  await page.waitForTimeout(550); // exceed the 480ms timer that must have been cancelled
  await expect(sixth).toHaveAttribute('open', '');
  await cards.nth(6).locator('summary').click();
  await expect(page.locator('.profile-card[open]')).toHaveCount(1);
  await expect(cards.nth(6)).toHaveAttribute('open', '');
});

test('keyboard skip link, disclosure controls and navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#content$/);
  await page.keyboard.press('Tab');
  const summary = page.locator('.profile-card summary').first();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.profile-card').first()).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(page.locator('.profile-card[open]')).toHaveCount(0);
  for (const id of ['profile', 'contact', 'about']) {
    await page.locator(`nav a[href="#${id}"]`).click();
    await expect(page.locator('nav [aria-current="location"]')).toHaveCount(1);
    await expect(page.locator(`nav a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location');
  }
});

test('reduced motion reveals content immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const selector of ['#about h1', '.quick-facts', '.section-head', '.contact-panel']) {
    await expect(page.locator(selector)).toHaveCSS('opacity', '1');
  }
  expect(await page.evaluate(() => getComputedStyle(document.body, '::after').animationName)).toBe('none');
});

test('contact accessibility, source facts and internal targets', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Contact links' })).toHaveCount(1);
  await expect(page.locator('.card-index[aria-hidden="true"]')).toHaveCount(7);
  await expect(page.locator('.fact-list dd').last()).toHaveText('Chinese · English · Korean · Japanese');
  await expect(page.locator('.lead-fields li')).toHaveText([
    'Qualitative sociological research', 'Sociology of ideology', 'Social change', 'Gender studies',
  ]);
  expect(await page.locator('[id]').evaluateAll(els => new Set(els.map(el => el.id)).size === els.length)).toBe(true);
  expect(await page.locator('a[href^="#"]').evaluateAll(els => els.every(el => document.getElementById(el.hash.slice(1))))).toBe(true);
  const publicWriting = page.locator('.contact-links a').last();
  await expect(publicWriting).toHaveAttribute('href', 'https://matters.town/@PicaPica');
  await expect(publicWriting).toHaveAttribute('rel', /noopener/);
});

test('printing shows every closed disclosure and preserves the reading state', async ({ page }, testInfo) => {
  const cards = page.locator('.profile-card');
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  // This catches content hidden by the native details content box, even when it has a size.
  expect(await page.locator('.card-details li').evaluateAll(items => items.length > 0 && items.every(el => el.checkVisibility()))).toBe(true);
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.skip-link')).toBeHidden();
  for (const icon of await page.locator('.card-icon').all()) await expect(icon).toBeHidden();
  const printLabels = await page.locator('.contact-links a').evaluateAll(links => links.map(el => getComputedStyle(el, '::after').content));
  expect(printLabels.join(' ')).toContain('ghwsocio@hanyang.ac.kr');
  expect(printLabels.join(' ')).toContain('matters.town/@PicaPica');
  await page.pdf({ path: testInfo.outputPath('profile-print.pdf'), format: 'A4' });
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('.profile-card[open]')).toHaveCount(0);
  await cards.nth(5).locator('summary').click();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('.profile-card[open]')).toHaveCount(7);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.profile-card[open]')).toHaveCount(1);
  await expect(cards.nth(5)).toHaveAttribute('open', '');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content, native disclosure and printable body remain available', async ({ page }) => {
    for (const selector of ['#about h1', '.quick-facts', '.section-head', '.contact-panel']) {
      await expect(page.locator(selector)).toHaveCSS('opacity', '1');
    }
    const cards = page.locator('.profile-card');
    await cards.nth(5).locator('summary').click();
    await cards.nth(6).locator('summary').click();
    await expect(page.locator('.profile-card[open]')).toHaveCount(2);
    await expect(page.locator('nav [aria-current]')).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    expect(await page.locator('.card-details li').evaluateAll(items => items.length > 0 && items.every(el => el.checkVisibility()))).toBe(true);
  });
});

test('public assets and discovery metadata are available in the served build', async ({ page, request }) => {
  for (const [path, mime] of [
    ['/assets/favicon.svg', 'image/svg+xml'], ['/assets/social-card.png', 'image/png'],
    ['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml'], ['/CNAME', 'text/plain'],
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain(mime);
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
    if (path.endsWith('.png')) {
      expect(body.subarray(1, 4).toString()).toBe('PNG');
      expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
    }
  }
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ghwsocio.social/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://ghwsocio.social/assets/social-card.png');
  const person = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(person['@type']).toBe('Person');
  expect(person.name).toBe(await page.locator('h1').textContent());
  expect(person.affiliation.name).toBe(await page.locator('.fact-list dd').first().textContent());
  expect(person.sameAs).toContain(await page.locator('.contact-links a').last().getAttribute('href'));
  for (const privatePath of ['/package.json', '/AGENTS.md', '/.git/config', '/tests/profile.spec.mjs']) {
    expect((await request.get(privatePath)).status()).toBe(404);
  }
});
