/**
 * White-label: a second API (3003) and a second web server (3004) started with WL_* set. Nothing a client can see
 * may contain the vendor's name; the reseller's name, colour, logo and favicon must show instead.
 */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import { accounts, api, login, watch } from '../lib';

const BRAND = 'Acme Payroll Cloud';
const WL = {
  WL_PRODUCT_NAME: BRAND, WL_PRIMARY_COLOR: '#7c3aed', WL_SUPPORT_EMAIL: 'help@acmepayroll.example', WL_EMAIL_FROM_NAME: 'Acme Payroll',
  WL_WEBSITE_URL: 'https://app.acmepayroll.example', WL_FAVICON_URL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  WL_LOGO_URL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
};
const FORBIDDEN = /matrix\s*-?hr|treevoxa/i; // (receipt numbers issued before a deployment went white-label keep their old prefix)
const API3 = 'http://localhost:3003/api/v1';
const WEB4 = 'http://localhost:3004';
const ROOT = new URL('../../../', `file://${__dirname}/`).pathname;
const kids: ChildProcess[] = [];

const call = async (token: string | null, path: string, method = 'GET', body?: unknown) => {
  const r = await fetch(`${API3}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, text: t };
};
async function waitFor(url: string, name: string) {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(url)).status < 500) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error(`${name} did not start`);
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  const env = { ...process.env, ...WL };
  kids.push(spawn('node', ['dist/main.js'], { cwd: `${ROOT}apps/api`, stdio: 'ignore', env: { ...env, PORT: '3003', WEB_URL: WEB4, BILLING_WORKER: 'off', THROTTLE_LIMIT: '100000', AUTH_THROTTLE_LIMIT: '100000',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://matrixhr:matrixhr@127.0.0.1:5433/matrixhr', REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6380',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-0123456789-abcdefghijklmnop', JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-0123456789-abcdefghijklmnopq',
    S3_ENDPOINT: 'http://127.0.0.1:9000', S3_ACCESS_KEY: 'S3RVER', S3_SECRET_KEY: 'S3RVER', S3_BUCKET: 'matrixhr', AI_OPENAI_BASE_URL: 'http://127.0.0.1:9100/v1' } }));
  kids.push(spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3004'], { cwd: `${ROOT}apps/web`, stdio: 'ignore', env: { ...env, NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1', WEB_URL: WEB4 } }));
  // The assistant needs the platform switch, a (mock-model) key and the company switch; restored in afterAll.
  const op = await api('superadmin', '/platform/ai/settings', 'PUT', { enabled: true, provider: 'openai', openaiKey: 'sk-qa-mock-key-000000' });
  expect(op.status, JSON.stringify(op.body)).toBeLessThan(300);
  await api('hr', '/ai/tenant', 'PUT', { enabled: true });
  await Promise.all([waitFor(`${API3}/health`, 'white-label API'), waitFor(`${WEB4}/login`, 'white-label web')]);
});
test.afterAll(async () => { kids.forEach((k) => k.kill()); await api('superadmin', '/platform/ai/settings', 'PUT', { enabled: false }); });

test.describe('white-label API', () => {
  test('/brand and /auth/me carry the reseller brand; the standard server is unchanged', async () => {
    const b = await call(null, '/brand');
    expect(b.body).toMatchObject({ whiteLabel: true, name: BRAND, primaryColor: '#7c3aed', supportEmail: WL.WL_SUPPORT_EMAIL, websiteUrl: WL.WL_WEBSITE_URL });
    expect(b.text).not.toMatch(FORBIDDEN);
    const std = await api(null, '/brand');
    expect(std.body).toMatchObject({ whiteLabel: false, name: 'MatrixHR' });
    const t = accounts().users.admin.token;
    const me = await call(t, '/auth/me');
    expect(me.body.brand.name).toBe(BRAND);
    expect(JSON.stringify(me.body.permissions.nav)).not.toMatch(FORBIDDEN);
  });

  test('emails, authenticator label, API docs and AI replies never name the vendor', async () => {
    const a = accounts().users.admin;
    // password-reset email (always answers the same, so it cannot be used to probe accounts)
    expect((await call(null, '/auth/forgot-password', 'POST', { email: a.email })).status).toBeLessThan(300);
    const outbox = await call(a.token, '/dev/outbox');
    const mine = (outbox.body as any[]).filter((m) => m.to === a.email);
    expect(mine.length).toBeGreaterThan(0);
    const last = mine[mine.length - 1];
    expect(`${last.subject}\n${last.text ?? ''}\n${last.body ?? ''}`).toContain(BRAND);
    expect(JSON.stringify(last)).not.toMatch(FORBIDDEN);

    const mfa = await call(accounts().users.employee.token, '/auth/mfa/setup', 'POST');
    if (mfa.status < 300) expect(decodeURIComponent(mfa.body.otpauthUrl)).toContain(BRAND.replace(/ /g, ' '));

    // AI: the system prompt itself (echoed by the mock model) and what the user would read
    const chat = await call(accounts().users.hr.token, '/ai/chat', 'POST', { message: 'echo system prompt' });
    expect(chat.status, chat.text).toBeLessThan(300);
    expect(chat.text).toContain(BRAND);
    expect(chat.text).not.toMatch(FORBIDDEN);
    const status = await call(accounts().users.hr.token, '/ai/status');
    expect(JSON.stringify(status.body)).not.toMatch(FORBIDDEN);

    const docs = await fetch('http://localhost:3003/api/docs-json').then((r) => r.text()).catch(() => '');
    if (docs) expect(docs).not.toMatch(FORBIDDEN);
  });
});

test.describe('white-label web', () => {
  test.use({ baseURL: WEB4 });
  for (const path of ['/login', '/forgot-password', '/reset-password?token=zz', '/accept-invite?token=zz', '/signup', '/kiosk', '/zz-not-a-page']) {
    test(`public page ${path} shows the reseller, never the vendor`, async ({ request }) => {
      const res = await request.get(`${WEB4}${path}`);
      const html = await res.text();
      expect(html, 'rendered HTML').not.toMatch(FORBIDDEN);
      if (!path.startsWith('/zz')) expect(html).toContain(BRAND);
    });
  }

  test('the vendor landing page is replaced by the sign-in; title, favicon, colour and logo come from config', async ({ page }) => {
    await page.goto(`${WEB4}/`, { waitUntil: 'networkidle' });
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(page).toHaveTitle(new RegExp(BRAND));
    expect(await page.title()).not.toMatch(FORBIDDEN);
    expect(await page.locator('link[rel~="icon"]').first().getAttribute('href')).toContain('data:image/png;base64');
    expect(await page.locator('img[alt="' + BRAND + '"]').count()).toBeGreaterThan(0);
    const c = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim());
    expect(c).toBe('124 58 237'); // #7c3aed
    const bg = await page.locator('button[type="submit"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgb(28, 126, 87)'); // not the default green
    expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);
    for (const p of ['/robots.txt', '/sitemap.xml']) expect(await (await page.request.get(`${WEB4}${p}`)).text()).not.toMatch(FORBIDDEN);
    expect((await page.request.get(`${WEB4}/opengraph-image`)).status()).toBeLessThan(500);
  });

  test('inside the app: every screen a client sees is free of the vendor name', async ({ page }) => {
    test.setTimeout(240_000);
    const problems = watch(page, [/Failed to fetch RSC payload/]); // in-flight prefetches aborted by the next page.goto
    page.on('dialog', (d) => d.dismiss());
    // The web build points at the standard API (3001); send its calls to the white-label API instead.
    await page.route('http://localhost:3001/**', (route) => route.continue({ url: route.request().url().replace('localhost:3001', 'localhost:3003') }));
    await login(page, 'admin');
    const leaks: string[] = [];
    const bad: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400 && r.status() !== 401 && !r.url().endsWith('/billing/quote')) bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
    for (const p of ['/dashboard', '/employees', '/ai', '/settings', '/settings/structure', '/settings/compensation', '/settings/leave', '/settings/api-keys', '/settings/webhooks', '/payroll', '/security', '/marketplace', '/whatsapp', '/reports', '/billing', '/leave', '/attendance', '/loans', '/expenses', '/recruitment', '/performance', '/onboarding', '/lms', '/surveys', '/settings/logins', '/settings/audit', '/settings/devices', '/settings/sso', '/settings/eor', '/timesheets', '/offboarding']) {
      await page.goto(`${WEB4}${p}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#main').waitFor({ timeout: 20_000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
      if (new URL(page.url()).pathname !== p) { leaks.push(`${p}: redirected to ${new URL(page.url()).pathname}`); continue; }
      const text = await page.locator('body').innerText();
      if (FORBIDDEN.test(text)) leaks.push(`${p}: ${text.match(FORBIDDEN)![0]}`);
      if (await page.title().then((t) => FORBIDDEN.test(t))) leaks.push(`${p}: title`);
    }
    expect(leaks, leaks.join('\n')).toEqual([]);
    await page.goto(`${WEB4}/ai`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: `Ask ${BRAND}` })).toBeVisible();
    expect(bad, 'failed requests').toEqual([]);
    expect(problems.filter((x) => !/Failed to load resource/.test(x))).toEqual([]);
  });

  test('the reseller backoffice is free of the vendor name too', async ({ page }) => {
    test.setTimeout(180_000);
    await page.route('http://localhost:3001/**', (route) => route.continue({ url: route.request().url().replace('localhost:3001', 'localhost:3003') }));
    await login(page, 'superadmin');
    const tenantId = (await api('admin', '/auth/me')).body.tenantId;
    const leaks: string[] = [];
    for (const p of ['/platform', '/platform/billing', '/platform/plans', '/platform/ai', '/platform/audit', `/platform/${tenantId}`]) {
      await page.goto(`${WEB4}${p}`, { waitUntil: 'networkidle' });
      if (new URL(page.url()).pathname !== p) { leaks.push(`${p}: redirected to ${new URL(page.url()).pathname}`); continue; }
      const text = await page.locator('body').innerText();
      if (FORBIDDEN.test(text)) leaks.push(`${p}: ${text.match(FORBIDDEN)![0]}`);
    }
    expect(leaks, leaks.join('\n')).toEqual([]);
    await page.goto(`${WEB4}/platform`, { waitUntil: 'networkidle' });
    await expect(page.getByText(`Every company on ${BRAND}`)).toBeVisible();
  });
});
