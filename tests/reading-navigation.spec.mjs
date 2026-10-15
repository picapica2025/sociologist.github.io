import { test, expect } from '@playwright/test';

const sectionIds = [
  'academic-work', 'research-interests', 'public-writing', 'education',
  'experience', 'skills', 'honors',
];
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function expectOpenTitleInView(page, id) {
  const card = page.locator(`#${id}`);
  await expect(page.locator('.profile-card[open]')).toHaveCount(1);
  await expect(card).toHaveAttribute('open', '');
  await expect(card).not.toHaveClass(/is-opening|is-closing/);
  await expect(card.locator('.card-details')).toHaveCSS('opacity', '1');
  await expect.poll(async () => card.locator('.card-title').evaluate(title => {
    const box = title.getBoundingClientRect();
    const nav = document.querySelector('.topbar').getBoundingClientRect();
    return box.top >= nav.bottom - 1 && box.bottom <= innerHeight + 1;
  }), { message: 'A linked section title must clear the mobile sticky navigation' }).toBe(true);
}

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`closing Skills restores Contact navigation with ${reducedMotion} motion`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const contact = page.locator('nav a[href="#contact"]');
    await contact.click();
    await expect(contact).toHaveAttribute('aria-current', 'location');
    // The active item can change during the last pixels of smooth scrolling.
    // Start this disclosure regression only after the Contact destination settles.
    let settledSamples = 0;
    await expect.poll(async () => {
      const atBottom = await page.evaluate(() => Math.abs(
        document.documentElement.scrollHeight - innerHeight - scrollY,
      ) <= 1);
      settledSamples = atBottom ? settledSamples + 1 : 0;
      return settledSamples;
    }, { intervals: [100] }).toBeGreaterThanOrEqual(3);

    const skills = page.locator('#skills');
    await skills.locator('summary').click();
    await expect(skills).toHaveAttribute('open', '');
    await expect(skills).not.toHaveClass(/is-opening|is-closing/);
    await expect(skills.locator('.card-details')).toHaveCSS('opacity', '1');
    await skills.locator('summary').click();
    await expect(skills).not.toHaveAttribute('open', '');
    await expect(page.locator('nav [aria-current="location"]')).toHaveCount(1);
    await expect(contact).toHaveAttribute('aria-current', 'location');
  });
}

test('each expanded section has a working link to its own stable fragment', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.locator('.profile-card').evaluateAll(cards => cards.map(card => card.id))).toEqual(sectionIds);

  for (const id of sectionIds) {
    const card = page.locator(`#${id}`);
    await card.locator('summary').click();
    const link = card.locator('.card-details .section-link');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', `#${id}`);
    await expect(link).toBeVisible();
    await link.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${id}`);
    await expect(card).toHaveAttribute('open', '');
    await expect(page.locator('.profile-card[open]')).toHaveCount(1);
  }
});

test('mobile direct fragments and browser history open the matching section in view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#honors');
  await expectOpenTitleInView(page, 'honors');

  await page.locator('#skills summary').click();
  await expectOpenTitleInView(page, 'skills');
  await page.locator('#skills .section-link').click();
  await expect(page).toHaveURL(/#skills$/);
  await expectOpenTitleInView(page, 'skills');

  await page.goBack();
  await expect(page).toHaveURL(/#honors$/);
  await expectOpenTitleInView(page, 'honors');
});

test('the existing Profile fragment still lands on its visible heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#profile');
  await expect(page.locator('.profile-card[open]')).toHaveCount(0);
  await expect(page.locator('nav a[href="#profile"]')).toHaveAttribute('aria-current', 'location');
  await expect.poll(() => page.locator('#profile-title').evaluate(title => {
    const box = title.getBoundingClientRect();
    return box.top >= document.querySelector('.topbar').getBoundingClientRect().bottom - 1
      && box.bottom <= innerHeight + 1;
  })).toBe(true);
});

for (const fragment of ['missing-section', '%E0%A4%A']) {
  test(`the fragment ${fragment} leaves disclosure and navigation controls usable`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/#${fragment}`);
    const academic = page.locator('#academic-work');
    await academic.locator('summary').click();
    await expect(academic).toHaveAttribute('open', '');
    await expect(academic.locator('.card-details')).toHaveCSS('opacity', '1');
    await academic.locator('summary').click();
    await expect(academic).not.toHaveAttribute('open', '');
    await page.locator('nav a[href="#profile"]').click();
    await expect(page).toHaveURL(/#profile$/);
    await expect(page.locator('nav a[href="#profile"]')).toHaveAttribute('aria-current', 'location');
  });
}

test('320px expanded sections keep readable body text and usable line width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const id of sectionIds) {
    const card = page.locator(`#${id}`);
    await card.locator('summary').click();
    await expect(card).toHaveAttribute('open', '');
    const body = card.locator('.card-details ul');
    expect(await body.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(240);
    const fontSizes = await body.locator('li').evaluateAll(items => items.map(item => parseFloat(getComputedStyle(item).fontSize)));
    expect(fontSizes.length).toBeGreaterThan(0);
    for (const fontSize of fontSizes) expect(fontSize).toBeGreaterThanOrEqual(14);
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
