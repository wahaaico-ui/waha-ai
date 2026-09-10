import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const baseURL = externalBaseUrl || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    locale: 'ar-SA',
    timezoneId: 'Asia/Gaza',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30_000,
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --hostname 127.0.0.1',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'android-legacy',
      use: {
        ...devices['Galaxy S8'],
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
      },
    },
  ],
});
