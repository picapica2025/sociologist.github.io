import { test, expect } from '@playwright/test';

const fontPath = '/assets/fonts/eb-garamond-latin.woff2';

async function waitForFonts(page) {
  await page.evaluate(() => document.fonts.ready);
}

async function sampleDisclosureClick(card) {
  // Observe the real click without opening native <details> during setup: doing
  // that caches an expanded before-change style inside its hidden content.
  await card.evaluate(element => {
    element.motionSamples = new Promise(resolve => {
      element.querySelector('summary').addEventListener('click', () => {
        const samples = [];
        const started = performance.now();
        const details = element.querySelector('.card-details');
        const sample = () => {
          samples.push({
            height: element.getBoundingClientRect().height,
            opacity: Number(getComputedStyle(details).opacity),
          });
          if (performance.now() - started < 700) requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame(sample);
      }, { once: true });
    });
  });
  await card.locator('summary').click();
  return card.evaluate(async element => {
    const samples = await element.motionSamples;
    delete element.motionSamples;
    return samples;
  });
}

async function expectFallbackLayoutToFit(page, width) {
  await page.setViewportSize({ width, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const fit = await page.locator('h1, #profile-title, #contact-title, .lead-fields, .profile-card summary')
    .evaluateAll(elements => elements.map(element => ({
      selector: element.id || element.className || element.tagName,
      fits: element.scrollWidth <= element.clientWidth + 1,
      right: element.getBoundingClientRect().right,
      viewport: innerWidth,
    })));
  expect(fit.filter(item => !item.fits || item.right > item.viewport + 1)).toEqual([]);

  for (const selector of ['#profile-title', '#contact-title']) {
    expect(await page.locator(selector).evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size;
    })).toBe(1);
  }
}

test('the self-hosted EB Garamond face and its license are served', async ({ page, request }) => {
  const fontResponse = page.waitForResponse(response => new URL(response.url()).pathname === fontPath);
  await page.goto('/');
  const response = await fontResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('font/woff2');
  const licenseResponse = await request.get('/assets/fonts/OFL.txt');
  expect(licenseResponse.status()).toBe(200);
  expect(await licenseResponse.text()).toMatch(/SIL Open Font License, Version 1\.1/i);
  await waitForFonts(page);

  const font = await page.locator('h1').evaluate(element => ({
    loaded: document.fonts.check('16px "EB Garamond"', 'Wang Guanxin'),
    status: document.fonts.status,
  }));
  expect(font.status).toBe('loaded');
  expect(font.loaded).toBe(true);
  const titleFamilies = await page.locator('h1, .card-title').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).fontFamily));
  expect(titleFamilies).toHaveLength(8);
  for (const family of titleFamilies) expect(family).toMatch(/^['"]?EB Garamond['"]?(?:,|$)/);
});

test('a failed webfont request falls back without narrow-screen overflow', async ({ page }) => {
  let blockedFonts = 0;
  await page.route('**/assets/fonts/**', async route => {
    blockedFonts++;
    await route.abort('failed');
  });
  await page.goto('/');
  await waitForFonts(page);
  expect(blockedFonts).toBeGreaterThan(0);
  expect(await page.evaluate(() => Array.from(document.fonts)
    .find(face => face.family.replaceAll('"', '') === 'EB Garamond')?.status)).toBe('error');

  for (const width of [390, 320]) await expectFallbackLayoutToFit(page, width);
});

for (const width of [1280, 390]) {
  test(`all seven disclosures pass through an intermediate height at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await waitForFonts(page);
    const cards = page.locator('.profile-card');
    await expect(cards).toHaveCount(7);

    for (let index = 0; index < 7; index++) {
      const card = cards.nth(index);
      const closed = await card.evaluate(element => element.getBoundingClientRect().height);
      const opening = await sampleDisclosureClick(card);
      const expanded = opening.at(-1).height;
      expect(expanded, `section ${index + 1} expands`).toBeGreaterThan(closed + 4);
      await expect(card).toHaveAttribute('open', '');
      const closing = await sampleDisclosureClick(card);
      for (const [direction, samples] of [['opening', opening], ['closing', closing]]) {
        const intermediate = samples.filter(sample => sample.height > closed + 1 && sample.height < expanded - 1);
        expect(new Set(intermediate.map(sample => sample.height)).size,
          `section ${index + 1} ${direction} has multiple intermediate heights`).toBeGreaterThanOrEqual(2);
        expect(samples.some(sample => sample.opacity > 0.01 && sample.opacity < 0.99),
          `section ${index + 1} ${direction} fades`).toBe(true);
      }
      expect(closing.at(-1).height).toBeCloseTo(closed, 0);
      await expect(card).not.toHaveAttribute('open', '');
    }
  });
}

test('rapid open-close-open cancels the stale opening frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const states = await page.locator('.profile-card').first().evaluate(async card => {
    const summary = card.querySelector('summary');
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    summary.click();
    await nextFrame(); // The original first frame has queued its second phase.
    summary.click();
    summary.click();
    const immediately = {
      open: card.open,
      opening: card.classList.contains('is-opening'),
      closing: card.classList.contains('is-closing'),
    };
    await nextFrame();
    const afterOneFrame = {
      open: card.open,
      opening: card.classList.contains('is-opening'),
      closing: card.classList.contains('is-closing'),
    };
    await nextFrame();
    const afterTwoFrames = {
      open: card.open,
      opening: card.classList.contains('is-opening'),
      closing: card.classList.contains('is-closing'),
    };
    return { immediately, afterOneFrame, afterTwoFrames };
  });

  expect(states.immediately).toEqual({ open: true, opening: true, closing: false });
  expect(states.afterOneFrame).toEqual({ open: true, opening: true, closing: false });
  expect(states.afterTwoFrames).toEqual({ open: true, opening: false, closing: false });
  await page.waitForTimeout(550);
  await expect(page.locator('.profile-card').first()).toHaveAttribute('open', '');
});

test('reduced motion is immediate and suppresses every staged animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const cards = page.locator('.profile-card');
  await expect(page.locator('#about h1')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.quick-facts')).toHaveCSS('animation-name', 'none');

  for (let index = 0; index < 7; index++) {
    const card = cards.nth(index);
    await card.locator('summary').click();
    await expect(page.locator('.profile-card[open]')).toHaveCount(1);
    await expect(card).not.toHaveClass(/is-opening|is-closing/);
    await expect(card.locator('.card-details')).toHaveCSS('transition-duration', '0s');
    expect(await card.locator('.card-details li').evaluateAll(items =>
      items.every(item => getComputedStyle(item).animationName === 'none'))).toBe(true);
  }
  await cards.nth(6).locator('summary').click();
  await expect(page.locator('.profile-card[open]')).toHaveCount(0);
});

test('normal motion defines no infinite animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('.profile-card summary').first().click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  expect(await page.evaluate(() => document.getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations === Infinity)
    .map(animation => animation.animationName || animation.id || '(unnamed)'))).toEqual([]);
  expect(await page.evaluate(() => document.querySelector('style').textContent.includes('infinite'))).toBe(false);
});

test('print exposes the disclosure wrapper without animation or clipping', async ({ page }) => {
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  await page.goto('/');
  const wrappers = page.locator('.card-details-inner');
  await expect(wrappers).toHaveCount(7);
  expect(await wrappers.evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element);
    return style.overflow === 'visible' && style.animationName === 'none';
  }))).toBe(true);
  expect(await page.locator('.card-details li').evaluateAll(items =>
    items.length > 0 && items.every(element => element.checkVisibility()))).toBe(true);
});
