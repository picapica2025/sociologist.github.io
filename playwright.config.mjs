import { defineConfig } from '@playwright/test';

const testPort = Number.parseInt(process.env.SITE_TEST_PORT || '4173', 10);
if (!Number.isInteger(testPort) || testPort < 1 || testPort > 65_535) {
  throw new Error(`Invalid SITE_TEST_PORT: ${process.env.SITE_TEST_PORT}`);
}
const testOrigin = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: testOrigin,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node scripts/serve.mjs${process.env.SITE_TEST_DIST ? ' --dist' : ''}`,
    url: testOrigin,
    env: { ...process.env, PORT: String(testPort) },
    reuseExistingServer: false,
  },
});
