/**
 * Two billing currencies: PKR for Pakistan, USD for everyone else. Prices come from the database in each currency (no FX),
 * a company's currency is fixed at sign-up and only the operator can change it, and quotes, payment accounts, receipts and
 * emails all follow it.
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { accounts, api, API } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const SHOTS = resolve(__dirname, '../../../docs/qa/screenshots');
const PASSWORD = 'ZzTest#Passw0rd1';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function signup(country: string | undefined, label: string, base = API) {
  const s = Math.random().toString(36).slice(2, 8);
  const r = await fetch(`${base}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `cur-${label}-${s}@qa.test`, password: PASSWORD, companyName: `${tag} ${label}`, subdomain: `zz-cur-${label}-${s}`.toLowerCase(), ...(country ? { country } : {}) }) });
  const body = await r.json();
  return { status: r.status, body, email: `cur-${label}-${s}@qa.test`, token: body.accessToken as string, tenantId: body.tenant?.id as string };
}
async function as(token: string, path: string, method = 'GET', body?: unknown, base = API) {
  const r = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
async function uploadProof(token: string, id: string) {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'proof.png');
  const r = await fetch(`${API}/billing/requests/${id}/proof`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/** Billing emails are queued in the EmailOutbox table (a worker sends them); read what was queued for an address. */
const queuedMail = (to: string, subjectLike: string) => execFileSync('psql', ['-h', process.env.PGHOST || '127.0.0.1', '-p', process.env.PGPORT || '5433', '-U', process.env.PGUSER || 'matrixhr', '-d', process.env.PGDATABASE || 'matrixhr', '-tAqc',
  `select subject || E'\n' || body from "EmailOutbox" where "toAddress"='${to.replace(/'/g, '')}' and subject like '${subjectLike}%' order by "createdAt" desc limit 1`], { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'matrixhr' } }).toString();

let pkrAcc: any, usdAcc: any;
test.beforeAll(async () => {
  // Our own accounts so the test does not depend on what the database already holds.
  pkrAcc = (await api('superadmin', '/platform/billing/accounts', 'POST', { label: `${tag} Raast`, bankName: 'ZZ Local Bank', accountTitle: 'ZZ Co', iban: 'PK00ZZ0000000000000001', currency: 'PKR' })).body;
  usdAcc = (await api('superadmin', '/platform/billing/accounts', 'POST', { label: `${tag} Wise`, bankName: 'ZZ Intl Bank', accountTitle: 'ZZ Co', iban: 'GB00ZZ0000000000000001', currency: 'USD' })).body;
  expect(pkrAcc.currency).toBe('PKR'); expect(usdAcc.currency).toBe('USD');
});
test.afterAll(async () => {
  for (const a of [pkrAcc, usdAcc]) if (a?.id) await api('superadmin', `/platform/billing/accounts/${a.id}`, 'PATCH', { isActive: false });
});

test.describe('currency is decided at sign-up from the country', () => {
  test('Pakistan is PKR; US, UK, UAE, another country and no country are USD', async () => {
    const cases: [string | undefined, string][] = [['PK', 'PKR'], ['pk', 'PKR'], ['US', 'USD'], ['GB', 'USD'], ['AE', 'USD'], ['DE', 'USD'], [undefined, 'USD']];
    for (const [country, want] of cases) {
      const t = await signup(country, `c${country ?? 'none'}`);
      expect(t.status, JSON.stringify(t.body)).toBe(201);
      const me = await as(t.token, '/auth/me');
      expect(me.body.tenant.billingCurrency, `country ${country}`).toBe(want);
      expect(me.body.tenant.country ?? null).toBe(country ? country.toUpperCase() : null);
      expect((await as(t.token, '/billing/catalog')).body.currency).toBe(want);
    }
    const bad = await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `x-${Date.now()}@qa.test`, password: PASSWORD, companyName: 'x co', subdomain: `zz-x-${Date.now().toString(36)}`, country: 'Pakistan' }) });
    expect(bad.status, 'country must be a 2-letter code').toBe(400);
  });
});

test.describe('prices and accounts follow the company currency', () => {
  test('catalog, quote, request, receipt and email are all PKR for a Pakistani company and all USD for another', async () => {
    const pk = await signup('PK', 'pk');
    const us = await signup('US', 'us');

    const cPk = (await as(pk.token, '/billing/catalog')).body;
    const cUs = (await as(us.token, '/billing/catalog')).body;
    expect(cPk.currency).toBe('PKR'); expect(cUs.currency).toBe('USD');
    const price = (c: any, code: string) => c.plans.find((p: any) => p.code === code);
    expect([price(cPk, 'starter').monthly, price(cPk, 'growth').monthly, price(cPk, 'business').monthly].map(Number)).toEqual([6999, 18999, 39999]);
    expect([price(cPk, 'starter').yearly, price(cPk, 'growth').yearly, price(cPk, 'business').yearly].map(Number)).toEqual([69990, 189990, 399990]);
    expect(Number(price(cPk, 'business').overagePerEmployee)).toBe(140);
    expect([price(cUs, 'starter').monthly, price(cUs, 'growth').monthly, price(cUs, 'business').monthly].map(Number)).toEqual([25, 69, 149]);
    expect(Number(price(cUs, 'business').overagePerEmployee)).toBe(0.5);
    expect(cPk.plans.every((p: any) => p.currency === 'PKR')).toBe(true);
    expect(cUs.plans.every((p: any) => p.currency === 'USD')).toBe(true);
    expect(cPk.creditPacks.map((k: any) => [k.code, Number(k.price), k.currency])).toEqual([['small', 2799, 'PKR'], ['medium', 12499, 'PKR'], ['large', 32999, 'PKR']]);
    expect(cUs.creditPacks.map((k: any) => [k.code, Number(k.price), k.currency])).toEqual([['small', 10, 'USD'], ['medium', 45, 'USD'], ['large', 120, 'USD']]);

    // only accounts in the company's own currency are visible
    expect(cPk.accounts.map((a: any) => a.currency)).toEqual(expect.arrayContaining(['PKR']));
    expect(cPk.accounts.every((a: any) => a.currency === 'PKR')).toBe(true);
    expect(cUs.accounts.every((a: any) => a.currency === 'USD')).toBe(true);
    expect(cPk.accounts.map((a: any) => a.id)).toContain(pkrAcc.id);
    expect(cPk.accounts.map((a: any) => a.id)).not.toContain(usdAcc.id);
    expect(cUs.accounts.map((a: any) => a.id)).toContain(usdAcc.id);

    // quotes
    const qPk = (await as(pk.token, '/billing/quote', 'POST', { purpose: 'plan', planCode: 'growth', period: 'monthly' })).body;
    expect([qPk.currency, qPk.expectedAmount]).toEqual(['PKR', '18999.00']);
    expect((await as(pk.token, '/billing/quote', 'POST', { purpose: 'plan', planCode: 'growth', period: 'yearly' })).body.expectedAmount).toBe('189990.00');
    expect((await as(us.token, '/billing/quote', 'POST', { purpose: 'plan', planCode: 'growth', period: 'monthly' })).body).toMatchObject({ currency: 'USD', expectedAmount: '69.00' });
    expect((await as(pk.token, '/billing/quote', 'POST', { purpose: 'credit_pack', packCode: 'medium' })).body).toMatchObject({ currency: 'PKR', expectedAmount: '12499.00' });
    expect((await as(us.token, '/billing/quote', 'POST', { purpose: 'credit_pack', packCode: 'medium' })).body).toMatchObject({ currency: 'USD', expectedAmount: '45.00' });

    // a company cannot pay into the other currency's account
    expect((await as(pk.token, '/billing/requests', 'POST', { purpose: 'plan', planCode: 'growth', period: 'monthly', accountId: usdAcc.id })).status).toBe(404);
    expect((await as(us.token, '/billing/requests', 'POST', { purpose: 'plan', planCode: 'growth', period: 'monthly', accountId: pkrAcc.id })).status).toBe(404);

    // full pay flow in PKR: request, proof, approval, receipt, email
    const rq = await as(pk.token, '/billing/requests', 'POST', { purpose: 'plan', planCode: 'growth', period: 'monthly', accountId: pkrAcc.id });
    expect(rq.status, JSON.stringify(rq.body)).toBeLessThan(300);
    expect([rq.body.currency, Number(rq.body.expectedAmount)]).toEqual(['PKR', 18999]);
    expect((await uploadProof(pk.token, rq.body.id)).status).toBeLessThan(300);
    const ap = await api('superadmin', `/platform/billing/requests/${rq.body.id}/approve`, 'POST', {});
    expect(ap.status, JSON.stringify(ap.body)).toBeLessThan(300);
    const rc = await as(pk.token, `/billing/requests/${rq.body.id}/receipt`);
    expect(rc.body).toMatchObject({ currency: 'PKR', amount: '18999.00' });
    const mailPk = queuedMail(pk.email, 'Payment received');
    expect(mailPk).toContain('Amount received: PKR 18,999');
    expect(mailPk).not.toContain('$');

    // full pay flow in USD, buying AI credits
    const rqUs = await as(us.token, '/billing/requests', 'POST', { purpose: 'credit_pack', packCode: 'small', accountId: usdAcc.id });
    expect([rqUs.body.currency, Number(rqUs.body.expectedAmount)]).toEqual(['USD', 10]);
    expect((await uploadProof(us.token, rqUs.body.id)).status).toBeLessThan(300);
    expect((await api('superadmin', `/platform/billing/requests/${rqUs.body.id}/approve`, 'POST', {})).status).toBeLessThan(300);
    expect((await as(us.token, `/billing/requests/${rqUs.body.id}/receipt`)).body).toMatchObject({ currency: 'USD', amount: '10.00' });
    expect(queuedMail(us.email, 'Payment received')).toContain('Amount received: $10');

    // AI credits purchased in PKR
    const rqPk2 = await as(pk.token, '/billing/requests', 'POST', { purpose: 'credit_pack', packCode: 'small', accountId: pkrAcc.id });
    expect([rqPk2.body.currency, Number(rqPk2.body.expectedAmount)]).toEqual(['PKR', 2799]);
    await as(pk.token, `/billing/requests/${rqPk2.body.id}/cancel`, 'POST');
  });
});

test.describe('only the operator can change a currency', () => {
  test('a company admin cannot; the operator can, with a reason, audited, never while a payment is open', async () => {
    const t = await signup('PK', 'chg');
    // the company has no endpoint for it, and cannot smuggle it into the branding endpoint
    expect((await as(t.token, `/platform/tenants/${t.tenantId}/currency`, 'PATCH', { currency: 'USD', reason: 'I would like dollars' })).status).toBe(403);
    expect((await as(t.token, '/tenants/branding', 'PATCH', { billingCurrency: 'USD' })).status).toBe(400);
    expect((await as(t.token, '/auth/me')).body.tenant.billingCurrency).toBe('PKR');

    expect((await api('superadmin', `/platform/tenants/${t.tenantId}/currency`, 'PATCH', { currency: 'USD', reason: 'x' })).status, 'reason required').toBe(400);
    expect((await api('superadmin', `/platform/tenants/${t.tenantId}/currency`, 'PATCH', { currency: 'EUR', reason: 'a good reason' })).status).toBe(400);
    expect((await api('superadmin', '/platform/tenants/zz-nonexistent/currency', 'PATCH', { currency: 'USD', reason: 'a good reason' })).status).toBe(404);

    // an open payment freezes the currency
    const rq = await as(t.token, '/billing/requests', 'POST', { purpose: 'plan', planCode: 'starter', period: 'monthly', accountId: pkrAcc.id });
    expect(rq.status).toBeLessThan(300);
    expect((await api('superadmin', `/platform/tenants/${t.tenantId}/currency`, 'PATCH', { currency: 'USD', reason: 'customer moved abroad' })).status).toBe(409);
    await as(t.token, `/billing/requests/${rq.body.id}/cancel`, 'POST');

    const ok = await api('superadmin', `/platform/tenants/${t.tenantId}/currency`, 'PATCH', { currency: 'USD', reason: 'customer moved abroad' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body).toMatchObject({ billingCurrency: 'USD', changed: true });
    expect((await as(t.token, '/billing/catalog')).body).toMatchObject({ currency: 'USD' });
    expect((await as(t.token, '/billing/quote', 'POST', { purpose: 'plan', planCode: 'starter', period: 'monthly' })).body).toMatchObject({ currency: 'USD', expectedAmount: '25.00' });
    const audit = (await api('superadmin', '/platform/audit?limit=100')).body as any[];
    const entry = audit.find((a) => a.action === 'TENANT_CURRENCY_CHANGED' && a.targetId === t.tenantId);
    expect(entry.detail).toMatchObject({ from: 'PKR', to: 'USD', reason: 'customer moved abroad' });
  });
});

test.describe('public price list', () => {
  test('both currencies, no sign-in needed, matches the database', async () => {
    const r = await fetch(`${API}/pricing`);
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.currencies).toEqual(['PKR', 'USD']);
    const g = d.plans.find((p: any) => p.code === 'growth');
    expect(g.USD.monthly).toBe(69); expect(g.PKR.monthly).toBe(18999); expect(g.PKR.yearly).toBe(189990);
    expect(d.creditPacks.find((k: any) => k.code === 'large')).toMatchObject({ USD: 120, PKR: 32999 });
    // an operator edit shows up at once, and is audited
    const before = (await api('superadmin', '/platform/billing/plans')).body.find((p: any) => p.code === 'starter').versions.find((v: any) => v.isCurrent);
    expect((await api('superadmin', '/platform/billing/plans/starter', 'PATCH', { priceMonthlyPkr: 7499 })).status).toBe(200);
    expect((await (await fetch(`${API}/pricing`)).json()).plans.find((p: any) => p.code === 'starter').PKR.monthly).toBe(7499);
    await api('superadmin', '/platform/billing/plans/starter', 'PATCH', { priceMonthlyPkr: Number(before.priceMonthlyPkr) });
    expect((await (await fetch(`${API}/pricing`)).json()).plans.find((p: any) => p.code === 'starter').PKR.monthly).toBe(6999);
  });
});

test.describe('white-label deployments can offer one currency (WL_CURRENCIES)', () => {
  let child: ChildProcess; const PORT = 3005; const BASE = `http://localhost:${PORT}/api/v1`;
  test.beforeAll(async () => {
    child = spawn('node', ['dist/main.js'], {
      cwd: new URL('../../../apps/api', `file://${__dirname}/`).pathname, stdio: 'ignore',
      env: { ...process.env, PORT: String(PORT), WL_PRODUCT_NAME: 'Acme Payroll', WL_CURRENCIES: 'USD', BILLING_WORKER: 'off', THROTTLE_LIMIT: '100000', AUTH_THROTTLE_LIMIT: '100000',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://matrixhr:matrixhr@127.0.0.1:5433/matrixhr', REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6380',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-0123456789-abcdefghijklmnop', JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-0123456789-abcdefghijklmnopq',
        S3_ENDPOINT: 'http://127.0.0.1:9000', S3_ACCESS_KEY: 'S3RVER', S3_SECRET_KEY: 'S3RVER', S3_BUCKET: 'matrixhr' },
    });
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 1000)); }
    throw new Error('white-label API did not start');
  });
  test.afterAll(() => { child?.kill(); });

  test('a USD-only reseller bills a Pakistani client in USD, and the price list offers one currency', async () => {
    expect((await (await fetch(`${BASE}/brand`)).json()).currencies).toEqual(['USD']);
    const t = await signup('PK', 'wl', BASE);
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    expect((await as(t.token, '/auth/me', 'GET', undefined, BASE)).body.tenant.billingCurrency).toBe('USD');
    expect((await as(t.token, '/billing/catalog', 'GET', undefined, BASE)).body.currency).toBe('USD');
    expect((await (await fetch(`${BASE}/pricing`)).json()).currencies).toEqual(['USD']);
    expect((await as(accounts().users.superadmin.token, `/platform/tenants/${t.tenantId}/currency`, 'PATCH', { currency: 'PKR', reason: 'should be refused' }, BASE)).status).toBe(400);
  });
});

async function asVisitor(browser: any, opts: { country?: string; tz?: string }) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: opts.tz ?? 'UTC', extraHTTPHeaders: opts.country ? { 'cf-ipcountry': opts.country } : {} });
  const page: Page = await ctx.newPage();
  return { page, ctx };
}

test.describe('landing page prices (not signed in)', () => {
  test('a visitor from Pakistan sees PKR; US, UK and UAE visitors see USD', async ({ browser }) => {
    for (const [country, want, text] of [['PK', 'PKR', 'PKR 18,999'], ['US', 'USD', '$69'], ['GB', 'USD', '$69'], ['AE', 'USD', '$69']] as const) {
      const { page, ctx } = await asVisitor(browser, { country });
      await page.goto('/', { waitUntil: 'networkidle' });
      const pricing = page.locator('#pricing');
      await expect(pricing.getByText(text, { exact: true }).first(), `${country} sees ${text}`).toBeVisible();
      await expect(pricing.getByRole('radio', { name: want })).toHaveAttribute('aria-checked', 'true');
      if (country === 'PK') { await expect(pricing).toContainText('PKR 6,999'); await expect(pricing).toContainText('PKR 39,999'); await expect(pricing).toContainText('PKR 140 each'); await expect(pricing).not.toContainText('$'); await pricing.screenshot({ path: resolve(SHOTS, 'pricing-pkr.png') }); }
      else { await expect(pricing).toContainText('$25'); await expect(pricing).toContainText('$0.50 each'); await expect(pricing).not.toContainText(/PKR \d/); await pricing.screenshot({ path: resolve(SHOTS, `pricing-usd-${country.toLowerCase()}.png`) }); }
      await ctx.close();
    }
  });

  test('the switch changes every price, both ways', async ({ browser }) => {
    const { page, ctx } = await asVisitor(browser, { country: 'US' });
    await page.goto('/', { waitUntil: 'networkidle' });
    const pricing = page.locator('#pricing');
    await pricing.getByRole('radio', { name: 'PKR' }).click();
    await expect(pricing).toContainText('PKR 18,999'); await expect(pricing).toContainText('PKR 189,990 a year'); await expect(pricing).toContainText('PKR 2,799'); await expect(pricing).not.toContainText('$');
    await pricing.getByRole('radio', { name: 'USD' }).click();
    await expect(pricing).toContainText('$69'); await expect(pricing).toContainText('$690 a year'); await expect(pricing).not.toContainText(/PKR \d/);
    await ctx.close();
  });

  test('with no country header the browser time zone decides: Asia/Karachi is PKR, London is USD', async ({ browser }) => {
    const pk = await asVisitor(browser, { tz: 'Asia/Karachi' });
    await pk.page.goto('/', { waitUntil: 'networkidle' });
    await expect(pk.page.locator('#pricing').getByRole('radio', { name: 'PKR' })).toHaveAttribute('aria-checked', 'true');
    await expect(pk.page.locator('#pricing')).toContainText('PKR 18,999');
    await pk.ctx.close();
    const uk = await asVisitor(browser, { tz: 'Europe/London' });
    await uk.page.goto('/', { waitUntil: 'networkidle' });
    await expect(uk.page.locator('#pricing').getByRole('radio', { name: 'USD' })).toHaveAttribute('aria-checked', 'true');
    await expect(uk.page.locator('#pricing')).toContainText('$69');
    await uk.ctx.close();
  });
});

test.describe('sign-up and billing screens (UI)', () => {
  test('a Pakistani company signs up, sees PKR in Billing and can only pick PKR accounts; a US company sees USD', async ({ browser }) => {
    for (const [country, label, cur, price, pay] of [['PK', 'Pakistan', 'PKR', 'PKR 18,999', 'Pay PKR 18,999 by bank transfer'], ['US', 'United States', 'USD', '$69', 'Pay $69 by bank transfer']] as const) {
      const { page, ctx } = await asVisitor(browser, { country });
      const s = Math.random().toString(36).slice(2, 7);
      await page.goto('/signup', { waitUntil: 'networkidle' });
      await expect(page.locator('#su-country')).toHaveValue(country); // pre-selected from the visitor's country
      await expect(page.getByTestId('billing-currency-hint')).toContainText(cur === 'PKR' ? 'Pakistani rupees' : 'US dollars');
      await page.locator('#su-country').selectOption({ label });
      await page.fill('#su-company', `${tag} ui ${s}`);
      await page.fill('#su-email', `ui-${s}@qa.test`);
      await page.fill('#su-password', PASSWORD);
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
      await page.locator('#main').waitFor(); await page.waitForLoadState('networkidle'); // let the shell finish /auth/me before navigating away
      await page.goto('/billing', { waitUntil: 'networkidle' });
      await page.getByRole('radio', { name: /^Growth/ }).click();
      await expect(page.getByText(price, { exact: false }).first()).toBeVisible();
      // the account chooser appears when there is more than one account; every one offered is in the company's currency
      if (await page.locator('#acct').count()) {
        const options = await page.locator('#acct option').allTextContents();
        expect(options.every((o) => o.includes(`(${cur})`)), options.join(' | ')).toBe(true);
      }
      const other = cur === 'PKR' ? '(USD)' : '(PKR)';
      await expect(page.locator('#main')).not.toContainText(other);
      await shot(page, `billing-${cur.toLowerCase()}`);
      await ctx.close();
    }
  });
});
const shot = (p: Page, n: string) => p.screenshot({ path: resolve(SHOTS, `${n}.png`) });
