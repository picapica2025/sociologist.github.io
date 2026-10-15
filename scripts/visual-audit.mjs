import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Usage: npm run audit:visual [-- --url https://ghwsocio.social/]

Without --url, serve the existing dist build on 127.0.0.1:4190.
SITE_AUDIT_PORT selects another local port; PLAYWRIGHT_CHANNEL=chrome uses installed Chrome.
Save 24 full-page PNGs, index.html and report.json in visual-audit/<timestamp>.
Each 1280, 390 and 320px viewport captures the initial collapsed page and all seven sections individually.
Screenshots use reduced motion; inspect the gallery before approving a release.`);
  process.exit(0);
}
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--url')) {
  throw new Error('Expected --url <http(s) URL>, or --help.');
}
const port = Number(process.env.SITE_AUDIT_PORT || '4190');
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid SITE_AUDIT_PORT: ${process.env.SITE_AUDIT_PORT}`);
}
const requestedUrl = new URL(args[1] || `http://127.0.0.1:${port}/`);
if (!['http:', 'https:'].includes(requestedUrl.protocol) || requestedUrl.username || requestedUrl.password) {
  throw new Error('Use an http(s) URL without credentials.');
}

const startedAt = new Date().toISOString();
const output = join(root, 'visual-audit', startedAt.replaceAll(':', '-').replaceAll('.', '-'));
const shots = [];
const pageErrors = [];
let server;
let browser;

async function startServer() {
  await access(join(root, 'dist', 'index.html')).catch(() => {
    throw new Error('dist/index.html is missing. Run npm run build first.');
  });
  server = spawn(process.execPath, ['scripts/serve.mjs', '--dist'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error(`Preview server did not start. ${log.trim()}`)), 10_000);
    const finish = error => {
      clearTimeout(timer);
      server.off('error', onError);
      server.off('exit', onExit);
      error ? reject(error) : resolve();
    };
    const onError = error => finish(error);
    const onExit = code => finish(new Error(`Preview server exited (${code}). ${log.trim()}`));
    server.once('error', onError);
    server.once('exit', onExit);
    server.stderr.on('data', chunk => { log += chunk.toString(); });
    server.stdout.on('data', chunk => {
      log += chunk.toString();
      if (log.includes(`Preview: http://127.0.0.1:${port}`)) finish();
    });
  });
}

const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

try {
  if (!args.length) await startServer();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await mkdir(output, { recursive: true });

  for (const width of [1280, 390, 320]) {
    const viewport = { width, height: 900 };
    await page.setViewportSize(viewport);
    const response = await page.goto(requestedUrl.href, { waitUntil: 'load' });
    if (!response?.ok()) throw new Error(`Page returned HTTP ${response?.status() ?? 'no response'}.`);
    await page.evaluate(() => document.fonts.ready);
    const cards = page.locator('.profile-card');
    await expect(cards).toHaveCount(7);
    await expect(page.locator('.profile-card[open]')).toHaveCount(0);

    async function capture(state, title) {
      await page.evaluate(async () => {
        // Let the disclosure's queued reading-position adjustment finish first.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      const filename = `${width}-${state}.png`;
      await page.screenshot({ path: join(output, filename), fullPage: true, animations: 'disabled' });
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY, 'A full-page capture must stay at the top').toBe(0);
      shots.push({ viewport, state, title, filename, url: page.url(), scrollY });
      console.log(`Captured ${filename}`);
    }

    await capture('collapsed', 'Initial screen and all sections collapsed');
    for (let index = 0; index < 7; index++) {
      const card = cards.nth(index);
      const summary = card.locator('summary');
      const title = (await card.locator('.card-title').innerText()).trim();
      await summary.click();
      await expect(page.locator('.profile-card[open]')).toHaveCount(1);
      await expect(card).toHaveAttribute('open', '');
      await expect(card.locator('.card-details')).toHaveCSS('opacity', '1');
      await capture(`section-${index + 1}`, title);
      await summary.click();
      await expect(page.locator('.profile-card[open]')).toHaveCount(0);
    }
  }

  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  await writeFile(join(output, 'report.json'), `${JSON.stringify({
    createdAt: startedAt, requestedUrl: requestedUrl.href, reducedMotion: 'reduce', shots, pageErrors,
  }, null, 2)}\n`);
  const groups = [1280, 390, 320].map(width => `<section id="width-${width}">
    <h2>${width} × 900 px</h2>
    ${shots.filter(shot => shot.viewport.width === width).map(shot => `<figure>
      <figcaption>${escape(shot.state)} · ${escape(shot.title)}</figcaption>
      <a href="${shot.filename}"><img src="${shot.filename}" alt="${escape(shot.title)} at ${width}px" loading="lazy"></a>
    </figure>`).join('\n')}
  </section>`).join('\n');
  await writeFile(join(output, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Academic profile visual audit</title><style>
body{margin:0 auto;padding:24px;max-width:1440px;font:16px/1.5 system-ui,sans-serif;color:#25232b;background:#f5f4f7}
header{margin-bottom:36px}h1{margin-bottom:8px}nav{display:flex;gap:20px}section{margin:48px 0}
figure{margin:24px 0;padding:16px;background:white;border:1px solid #ddd9e4;border-radius:12px}
figcaption{margin-bottom:12px;font-weight:600}img{display:block;max-width:100%;height:auto;margin:auto;border:1px solid #eee}
a{color:#594891}p{overflow-wrap:anywhere}
</style></head><body><header><h1>Academic profile visual audit</h1>
<p>${escape(startedAt)} · <a href="${escape(requestedUrl.href)}">${escape(requestedUrl.href)}</a></p>
<p>24 full-page captures with reduced motion. The collapsed image includes the initial screen at its top.
Open an image for its original size; review spacing, wrapping and all expanded entries. This gallery records screenshots, not visual approval.</p>
<nav aria-label="Viewport widths"><a href="#width-1280">Desktop</a><a href="#width-390">Mobile</a><a href="#width-320">Narrow mobile</a><a href="report.json">JSON</a></nav>
</header><main>${groups}</main></body></html>\n`);
  console.log(`Visual audit: ${output}\nGallery: ${join(output, 'index.html')}`);
} finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    await new Promise(resolve => {
      server.once('exit', resolve);
      server.kill();
    });
  }
}
