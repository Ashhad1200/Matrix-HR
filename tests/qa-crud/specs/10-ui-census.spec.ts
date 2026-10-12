/**
 * Visits every page each role can reach (from the role's own nav), at 1366x768 and 375px, and records:
 * console errors, page errors, 5xx and unexpected 4xx responses, "undefined/NaN/Invalid Date" text, never-ending spinners,
 * horizontal overflow, and the page's buttons/inputs (written to docs/qa/ui-census.json to drive the form specs).
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { accounts, badText, login, type Who } from '../lib';

const OUT = resolve(__dirname, '../../../docs/qa');
const SHOTS = resolve(OUT, 'screenshots');
mkdirSync(SHOTS, { recursive: true });
const census: Record<string, any> = {};
const ROLES: Who[] = ['admin', 'hr', 'manager', 'employee', 'superadmin'];
// pages that need an id in the path are visited through their list page
const EXTRA: Record<string, string[]> = { admin: ['/employees/org-chart', '/recruitment/kanban', '/recruitment/preboarding', '/settings/leave', '/settings/structure', '/settings/compensation', '/settings/logins', '/settings/api-keys', '/settings/webhooks', '/settings/devices', '/settings/sso', '/settings/eor', '/settings/audit', '/performance/reviews', '/performance/enps', '/surveys'], hr: ['/settings/structure', '/settings/compensation'], superadmin: ['/platform/ai', '/platform/billing'] };

for (const who of ROLES) {
  test(`pages as ${who}: no console/network errors, no broken text, no overflow`, async ({ page }) => {
    test.setTimeout(1_500_000);
    const issues: string[] = [];
    const errs: string[] = [];
    // Next prefetches linked routes; our own rapid page.goto() cancels those requests, which logs 'Failed to fetch RSC payload'. That is test noise, not an app error.
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to fetch RSC payload/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 160)));
    const bad: string[] = [];
    page.on('response', (r) => { const u = r.url(); if (u.includes('/api/v1') && r.status() >= 400 && r.status() !== 401) bad.push(`${r.status()} ${r.request().method()} ${u.split('/api/v1')[1].slice(0, 70)}`); });

    await login(page, who);
    const me = await page.evaluate(async () => { const t = localStorage.getItem('accessToken'); const r = await fetch(`${(window as any).__API__ || 'http://localhost:3001/api/v1'}/auth/me`, { headers: { Authorization: `Bearer ${t}` } }); return r.json(); });
    const hrefs: string[] = await page.$$eval('aside a[href^="/"], nav a[href^="/"]', (as) => Array.from(new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))));
    const paths = Array.from(new Set([...hrefs, ...(EXTRA[who] ?? [])])).filter((p) => !p.startsWith('/kiosk'));
    expect(paths.length, 'the sidebar lists pages').toBeGreaterThan(3);

    for (const p of paths) {
      errs.length = 0; bad.length = 0;
      const resp = await page.goto(p, { waitUntil: 'domcontentloaded' }).catch((e) => { issues.push(`${p}: navigation failed ${e.message.slice(0, 80)}`); return null; });
      if (!resp) continue;
      await page.locator('#main').waitFor({ timeout: 15_000 }).catch(() => issues.push(`${p}: shell did not render`));
      await page.waitForTimeout(1200); // the app polls (notifications), so networkidle never settles; give requests time to land
      const url = new URL(page.url());
      if (url.pathname !== p && !p.startsWith(url.pathname)) issues.push(`${p}: redirected to ${url.pathname}`);
      const words = await badText(page);
      if (words.length) issues.push(`${p}: shows ${words.join(', ')}`);
      const spinner = await page.locator('[role="progressbar"], .animate-spin').count();
      if (spinner) { await page.waitForTimeout(3000); if (await page.locator('[role="progressbar"], .animate-spin').count()) issues.push(`${p}: spinner still showing after load`); }
      if (errs.length) issues.push(`${p}: console: ${errs.slice(0, 2).join(' | ')}`);
      if (bad.length) issues.push(`${p}: ${bad.slice(0, 3).join(' | ')}`);
      const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (over) issues.push(`${p}: horizontal overflow at 1366px`);
      const info = await page.evaluate(() => ({
        title: document.querySelector('h1')?.textContent?.trim() ?? '',
        buttons: Array.from(document.querySelectorAll('#main button')).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 25),
        inputs: Array.from(document.querySelectorAll('#main input, #main select, #main textarea')).length,
        tableRows: document.querySelectorAll('#main tbody tr').length,
      }));
      census[`${who}:${p}`] = info;
      await page.screenshot({ path: resolve(SHOTS, `page-${who}-${p.replace(/\//g, '_') || 'root'}.png`) });
    }
    // the same pages at the smallest supported width
    await page.setViewportSize({ width: 375, height: 740 });
    for (const p of paths.slice(0, 14)) {
      await page.goto(p, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await page.locator('#main').waitFor({ timeout: 15_000 }).catch(() => undefined);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 24) issues.push(`${p}: horizontal overflow of ${over}px at 375px`);
    }
    void me; void accounts;
    writeFileSync(resolve(OUT, 'ui-census.json'), JSON.stringify(census, null, 1));
    expect(issues, issues.join('\n')).toEqual([]);
  });
}
