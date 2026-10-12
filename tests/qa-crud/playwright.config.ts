import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

// CRUD test suite. Runs ONLY against a local/staging stack: global-setup refuses anything that looks like production.
export default defineConfig({
  testDir: './specs',
  globalSetup: require.resolve('./global-setup.ts'),
  fullyParallel: false, // the specs share two tenants; keep ordering deterministic
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: resolve(__dirname, 'results.json') }]],
  use: {
    baseURL: process.env.WEB_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    launchOptions: { executablePath: process.env.CHROMIUM || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
});
