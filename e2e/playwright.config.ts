import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry always on: against `next dev` (not a production build), a cold route can take
  // longer to compile than a single assertion timeout allows. A retry distinguishes that from
  // a real regression without masking one — a genuinely broken flow fails on retry too.
  retries: 1,
  // Capped rather than unbounded: too many workers means too many pages hitting an uncompiled
  // dev-server route at once, which is what caused the original flakiness.
  workers: 4,
  reporter: [['html', { open: 'never', outputFolder: resolve(__dirname, 'report') }], ['list']],
  globalSetup: require.resolve('./global-setup.ts'),
  timeout: 45000,
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 20000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
