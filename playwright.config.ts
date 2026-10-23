import { defineConfig, devices } from '@playwright/test';

// Local/CI runs serve dist/ through the Firebase Hosting emulator: same cleanUrls, headers and
// real 404 status as production. (Also avoids `astro preview` auto-backgrounding under AI agents.)
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5000';

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  // Smoke tests against a deployed URL set BASE_URL; otherwise build + serve via the emulator.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm serve:firebase',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
