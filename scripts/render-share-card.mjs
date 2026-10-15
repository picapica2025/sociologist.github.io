import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const svg = await readFile(new URL('../assets/social-card.svg', import.meta.url), 'utf8');
  await page.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('../assets/social-card.png', import.meta.url)) });
} finally {
  await browser.close();
}
