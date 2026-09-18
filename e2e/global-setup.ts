/**
 * Logs into each demo role ONCE and saves its storage state to e2e/.auth/<role>.json.
 * Spec files then reuse that state via `test.use({ storageState: ... })` instead of
 * logging in per-test — this is what "authentication sharing" buys us: one login per
 * role per run, not one per spec.
 */
import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const AUTH_DIR = resolve(__dirname, '.auth');

const ROLES = {
  admin: 'admin@acme.com',
  hr: 'hr@acme.com',
  manager: 'ali.khan@acme.com',
  employee: 'sara.ahmed@acme.com',
} as const;

async function saveState(role: keyof typeof ROLES, email: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.context().storageState({ path: resolve(AUTH_DIR, `${role}.json`) });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const [role, email] of Object.entries(ROLES)) {
    await saveState(role as keyof typeof ROLES, email);
  }
}
