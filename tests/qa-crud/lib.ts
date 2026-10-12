import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Page } from '@playwright/test';

export const API = process.env.API_URL || 'http://localhost:3001/api/v1';
export const accounts = () => JSON.parse(readFileSync(resolve(__dirname, '.auth/accounts.json'), 'utf8'));
export type Who = 'admin' | 'hr' | 'manager' | 'employee' | 'employee2' | 'employeeB' | 'adminB' | 'superadmin';

export async function api(who: Who | null, path: string, method = 'GET', body?: unknown) {
  const a = who ? accounts().users[who] : null;
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', ...(a ? { authorization: `Bearer ${a.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { status: res.status, body: j };
}

export async function login(page: Page, who: Who) {
  const u = accounts().users[who];
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', u.email);
  await page.fill('input[type="password"]', u.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|platform)/, { timeout: 30_000 });
  await page.locator('#main').waitFor();
  await page.waitForLoadState('networkidle');
}

/** Collects the things that must stay empty on every page: console errors, page errors, unexpected 5xx. */
export function watch(page: Page, allow: RegExp[] = []) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !allow.some((r) => r.test(m.text()))) problems.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`); });
  return problems;
}

export async function badText(page: Page) {
  const t = await page.locator('body').innerText();
  return ['undefined', 'NaN', 'Invalid Date', '[object Object]'].filter((w) => new RegExp(`(^|[^A-Za-z])${w}([^A-Za-z]|$)`).test(t));
}
