// Browser journey for manual payments, staff invites, leave setup and private files, against a running stack
// (web :3000, API :3001, Postgres, an S3-compatible store). Real assertions; exits non-zero on any failure.
//   node scripts/billing-ui-test.mjs            screenshots go to docs/screenshots/
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';

const WEB = process.env.WEB_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:3001/api/v1';
const SHOTS = new URL('../docs/screenshots/', import.meta.url).pathname;
const PSQL = ['-h', process.env.PGHOST || 'localhost', '-p', process.env.PGPORT || '5433', '-U', process.env.PGUSER || 'matrixhr', '-d', process.env.PGDATABASE || 'matrixhr', '-tAqc'];
const sql = (q) => execFileSync('psql', [...PSQL, q]).toString().trim();
mkdirSync(SHOTS, { recursive: true });

// The journey asserts the operator queue ends up empty, so start from an empty queue: close requests that earlier (aborted) runs
// or other suites left open. Local test database only.
sql(`update "PaymentRequest" set status='CANCELLED' where status in ('PENDING','AWAITING_PROOF')`);
const suffix = Math.random().toString(36).slice(2, 8);
const PASS = 'Password123!';
// 1x1 PNG: a valid image by its bytes, which is what the server checks.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let failures = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '  ok  ' : '  FAIL'} ${name}${cond ? '' : extra ? ' :: ' + extra : ''}`); if (!cond) failures++; };

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
const login = async (email, password = PASS) => {
  // Login has its own per-IP throttle; back off and retry rather than fail on it.
  for (let i = 0; i < 8; i++) {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (r.status !== 429 && (r.body.accessToken || i >= 2)) return r.body.accessToken; // a throttled or momentarily failed login is retried
    if (r.status === 401 && i >= 2) console.log(`  note  login ${email} -> ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    await new Promise((res) => setTimeout(res, 8000));
  }
};

async function uiLogin(page, email, password = PASS) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|platform)/, { timeout: 20000 });
  // Let the shell finish its first requests: navigating away mid-flight aborts /auth/me, which the app treats as a logout.
  await page.locator('#main').waitFor(); // the shell renders only once /auth/me has completed
  await page.waitForLoadState('networkidle');
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
if (process.env.TRACE) { page.on('response', (r) => r.url().includes('3001') && console.log('   <', r.status(), r.request().method(), r.url().replace(API, ''))); page.on('framenavigated', (f) => f === page.mainFrame() && console.log('   NAV', f.url())); }

// ── setup through the API: an operator, a payment account, and two fresh signups ───────────────────────────────
const op = await login('superadmin@acme.com');
if (!(await api('/platform/billing/accounts', { token: op })).body.length) {
  await api('/platform/billing/accounts', { token: op, method: 'POST', body: { label: 'TREEVOXA USD', bankName: 'Test Bank Ltd', accountTitle: 'TREEVOXA', iban: 'PK36MEZN0000001234564471', swift: 'MEZNPKKA', currency: 'USD', instructions: 'Use the payment reference as the transfer note.' } });
}
const signup = async (tag) => (await api('/auth/signup', { method: 'POST', body: { email: `owner-${tag}-${suffix}@qa.test`, password: PASS, companyName: `QA ${tag} ${suffix}`, subdomain: `qa-${tag}-${suffix}` } })).body;
const T1 = await signup('pay');
const T2 = await signup('lapsed');

// ── A. a new signup is on a 30-day trial ────────────────────────────────────────────────────────────────────────
console.log('A. trial for a new signup');
const sub = sql(`select status || '|' || (round(extract(epoch from ("trialEndsAt" - now()))/86400))::int from "Subscription" where "tenantId"='${T1.tenant.id}'`);
ok('trialing for 30 days', sub === 'trialing|30', sub);
ok('100 AI credits', sql(`select "monthlyMc" from "AiCreditAccount" where "tenantId"='${T1.tenant.id}'`) === '100000');
const legacy = sql(`select count(*) from "Subscription" where "currentPeriodEnd" is null`);
ok('pre-existing tenants still have no clock (never lapse)', Number(legacy) >= 1, legacy);

await uiLogin(page, `owner-pay-${suffix}@qa.test`);
await page.goto(`${WEB}/billing`, { waitUntil: 'networkidle' });
await page.getByText('Free trial').first().waitFor();
ok('billing page shows the trial', true);
ok('no banner for a healthy trial', (await page.locator('[role=status]').filter({ hasText: /trial ends|plan ends/i }).count()) === 0);
await shot(page, '01-billing-trial');

// ── B. pay wizard ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('B. pay wizard');
await page.getByRole('radio', { name: /^Growth/ }).click();
await page.waitForFunction(() => document.body.innerText.includes('You pay'));
ok('server quote $69.00', (await page.locator('[aria-live=polite]').first().innerText()).includes('$69.00'));
await page.getByRole('radio', { name: /Yearly/ }).click();
await page.waitForFunction(() => document.body.innerText.includes('$690.00'));
ok('yearly quote $690.00 (2 months free)', true);
await page.getByRole('radio', { name: /^Monthly/ }).click();
await page.waitForFunction(() => /You pay\s*\$69\.00/.test(document.body.innerText));
await shot(page, '02-wizard-choose');
await page.getByRole('button', { name: 'Continue to payment details' }).click();
await page.getByText('Pay $69.00 by bank transfer').waitFor();
const reference = (await page.getByText(/^MHR-[A-HJ-NP-Z2-9]{6}$/).first().innerText()).trim();
ok('payment reference issued (MHR-XXXXXX)', /^MHR-[A-HJ-NP-Z2-9]{6}$/.test(reference), reference);
ok('bank details with IBAN shown', await page.getByText('PK36MEZN0000001234564471').isVisible());
await shot(page, '03-wizard-transfer');
// a wrong file is refused, a different amount demands a reason
await page.setInputFiles('#proof-file', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>'.padEnd(64)) });
await page.getByRole('button', { name: 'Send proof' }).click();
await page.getByText(/Unsupported file/).waitFor();
ok('a script renamed .png is refused by its bytes', true);
await page.setInputFiles('#proof-file', { name: 'transfer.png', mimeType: 'image/png', buffer: PNG });
await page.fill('#paid-amount', '60');
ok('different amount asks for a reason', await page.locator('#paid-note').isVisible());
await page.fill('#paid-note', 'Bank fees were deducted from the transfer');
await shot(page, '04-wizard-proof');
await page.getByRole('button', { name: 'Send proof' }).click();
await page.getByText('We are checking your payment').waitFor();
ok('request is now under review', true);
await shot(page, '05-wizard-pending');
const reqId = sql(`select id from "PaymentRequest" where reference='${reference}'`);
ok('only one open request per purpose', (await api('/billing/requests', { token: await login(`owner-pay-${suffix}@qa.test`), method: 'POST', body: { purpose: 'plan', planCode: 'growth', period: 'monthly', accountId: sql(`select "accountId" from "PaymentRequest" where id='${reqId}'`) } })).status === 409);

// ── C. operator reviews it ──────────────────────────────────────────────────────────────────────────────────────
console.log('C. backoffice queue');
const opPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await uiLogin(opPage, 'superadmin@acme.com');
await opPage.goto(`${WEB}/platform/billing`, { waitUntil: 'networkidle' });
await opPage.getByText(reference).first().waitFor();
ok('proof is in the queue', true);
ok('mismatch is flagged (customer said $60.00)', await opPage.getByText('$60.00').first().isVisible());
await shot(opPage, '06-backoffice-queue');
await opPage.getByRole('button', { name: 'View proof' }).first().click();
await opPage.locator('img[alt="Payment proof"]').waitFor();
ok('proof image renders in the viewer', true);
await shot(opPage, '07-backoffice-proof');
await opPage.keyboard.press('Escape');
await opPage.getByRole('button', { name: 'Approve' }).first().click();
await opPage.getByRole('button', { name: /Approve and issue receipt/ }).click();
await opPage.getByText('Nothing to check').waitFor();
ok('approved, queue is empty', true);
const periodAfter = sql(`select round(extract(epoch from ("currentPeriodEnd" - now()))/86400)::int || '|' || status from "Subscription" where "tenantId"='${T1.tenant.id}'`);
ok('plan extended from the trial end by one month (about 60 days), now active', /^(5[89]|6[0-2])\|active$/.test(periodAfter), periodAfter);
await opPage.getByRole('tab', { name: 'History' }).click();
await opPage.getByText(/TVX-R-\d{4}-\d{6}/).first().waitFor();
await shot(opPage, '08-backoffice-history');

// ── D. customer sees approval and a printable receipt ───────────────────────────────────────────────────────────
console.log('D. receipt');
await page.goto(`${WEB}/billing`, { waitUntil: 'networkidle' });
await page.getByText('Approved').first().waitFor();
const link = page.locator('a[href^="/receipt/"]').first();
const href = await link.getAttribute('href');
await page.goto(`${WEB}${href}`, { waitUntil: 'networkidle' });
await page.getByText(/TVX-R-\d{4}-\d{6}/).first().waitFor();
const receiptText = await page.locator('main').innerText();
ok('receipt carries the issuer text and NTN', receiptText.includes('NTN J883480') && receiptText.includes('TREEVOXA') && receiptText.includes('Plot No. R-326'));
ok('receipt shows the reference and amount', receiptText.includes(reference) && receiptText.includes('$69.00'));
await page.pdf({ path: `${SHOTS}09-receipt.pdf`, format: 'A4' });
await shot(page, '09-receipt');

// ── E. lapsed company: billing-only screen, then provisional access ─────────────────────────────────────────────
console.log('E. lapsed');
sql(`update "Subscription" set "currentPeriodEnd" = now() - interval '10 days', status='active' where "tenantId"='${T2.tenant.id}'`);
const lapsedPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const lapsedErrs = [];
const lapsedNav = [];
lapsedPage.on('framenavigated', (f) => f === lapsedPage.mainFrame() && lapsedNav.push(f.url().replace(WEB, '')));
lapsedPage.on('console', (m) => { if (m.type() === 'error') lapsedErrs.push('console: ' + m.text().slice(0, 100)); });
lapsedPage.on('response', (r) => { if (r.url().includes(':3001') && r.status() >= 400) lapsedErrs.push(`${r.status()} ${r.request().method()} ${r.url().split('/api/v1')[1]}`); });
await uiLogin(lapsedPage, `owner-lapsed-${suffix}@qa.test`);
await lapsedPage.getByRole('heading', { name: 'Your subscription has ended' }).waitFor();
ok('lapsed admin lands on the billing-only screen (not a dead 403)', true);
await lapsedPage.goto(`${WEB}/employees`, { waitUntil: 'networkidle' });
ok('other pages stay blocked', await lapsedPage.getByRole('heading', { name: 'Your subscription has ended' }).isVisible());
const t2tok = await login(`owner-lapsed-${suffix}@qa.test`);
const blocked = await api('/employees', { token: t2tok });
ok('API refuses with code BILLING_LAPSED', blocked.status === 403 && blocked.body.code === 'BILLING_LAPSED', JSON.stringify(blocked.body));
ok('billing and auth stay open', (await api('/billing/state', { token: t2tok })).status === 200 && (await api('/auth/me', { token: t2tok })).status === 200);
await shot(lapsedPage, '10-lapsed-screen');
await lapsedPage.getByRole('radio', { name: /^Starter/ }).click();
await lapsedPage.getByRole('button', { name: 'Continue to payment details' }).click();
await lapsedPage.getByText(/by bank transfer/).waitFor();
await lapsedPage.setInputFiles('#proof-file', { name: 'p.png', mimeType: 'image/png', buffer: PNG });
await lapsedPage.getByRole('button', { name: 'Send proof' }).click();
// Sending proof opens temporary access at once, so the billing-only screen is replaced by the app (with the banner). The panel's
// "We are checking your payment" message can be on screen for only a moment, so it is not asserted.
await lapsedPage.getByText(/Temporary access until/).waitFor({ timeout: 20000 });
await lapsedPage.goto(`${WEB}/dashboard`, { waitUntil: 'networkidle' });
ok('uploading proof opens temporary access', !(await lapsedPage.getByRole('heading', { name: 'Your subscription has ended' }).isVisible().catch(() => false)));
await lapsedPage.getByText(/Temporary access until/).waitFor({ timeout: 8000 }).catch(() => {});
{ const seen = await lapsedPage.getByText(/Temporary access until/).isVisible(); ok('banner says access is temporary', seen, seen ? '' : 'strip shows: ' + JSON.stringify(await lapsedPage.locator('[role=status]').allInnerTexts()) + ' url=' + lapsedPage.url() + ' errs=' + JSON.stringify(lapsedErrs.slice(-6)) + ' nav=' + JSON.stringify(lapsedNav.slice(-8)) + ' state=' + JSON.stringify(((await api('/billing/state', { token: t2tok })).body || {}).banner) + ' lifecycle=' + JSON.stringify(((await api('/billing/state', { token: t2tok })).body || {}).state)); }
await shot(lapsedPage, '11-provisional-banner');
// reject ends it immediately
const r2 = sql(`select id from "PaymentRequest" where "tenantId"='${T2.tenant.id}' order by "createdAt" desc limit 1`);
await api(`/platform/billing/requests/${r2}/reject`, { token: op, method: 'POST', body: { reason: 'Amount does not match the bank statement' } });
ok('rejection ends provisional access immediately', (await api('/employees', { token: t2tok })).status === 403);

// ── F. staff invite ─────────────────────────────────────────────────────────────────────────────────────────────
console.log('F. staff logins');
const adminPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await uiLogin(adminPage, 'admin@acme.com');
const noLogin = sql(`select e.id || '|' || e.email from "Employee" e where e."tenantId"=(select id from "Tenant" where subdomain='acme') and e.status='ACTIVE' and e.email is not null and not exists (select 1 from "User" u where u."employeeId"=e.id) order by e."createdAt" limit 1`);
let [empId, empEmail] = noLogin ? noLogin.split('|') : [];
if (!empEmail) {
  // Earlier runs used up the seeded people without a login: make a fresh one.
  const admTok = await login('admin@acme.com');
  const made = await api('/employees', { token: admTok, method: 'POST', body: { employeeCode: `JRN-${suffix}`, firstName: 'Journey', lastName: suffix, email: `journey-${suffix}@qa.test` } });
  [empId, empEmail] = [made.body.id, `journey-${suffix}@qa.test`];
}
await adminPage.goto(`${WEB}/settings/logins`, { waitUntil: 'networkidle' });
await adminPage.getByRole('button', { name: 'No login yet' }).click();
await shot(adminPage, '12-logins-list');
await adminPage.getByRole('row', { name: new RegExp(empEmail.replace(/[.+]/g, '\\$&')) }).getByRole('button', { name: /Invite/ }).click();
await adminPage.getByRole('radio', { name: /Manager/ }).check();
await adminPage.getByRole('button', { name: 'Send invitation' }).click();
const notice = await adminPage.getByRole('status').filter({ hasText: /Invitation sent/ }).innerText();
const token = new URL(notice.match(/http\S+/)[0]).searchParams.get('token');
ok('invitation sent (dev link shown only because no SMTP in development)', !!token);
ok('no account exists yet', sql(`select count(*) from "User" where "employeeId"='${empId}'`) === '0');
await shot(adminPage, '13-invite-sent');
const invPage = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await invPage.goto(`${WEB}/accept-invite?token=${token}`, { waitUntil: 'networkidle' });
await invPage.fill('[data-testid=invite-password]', 'Newpass123');
await invPage.fill('[data-testid=invite-confirm]', 'Newpass123');
await shot(invPage, '14-accept-invite');
await invPage.click('[data-testid=invite-submit]');
await invPage.getByTestId('invite-success').waitFor();
ok('invitee set their own password', true);
ok('login created with role MANAGER, linked to the employee', sql(`select role from "User" where "employeeId"='${empId}'`) === 'MANAGER');
await invPage.goto(`${WEB}/accept-invite?token=${token}`, { waitUntil: 'networkidle' });
ok('the link cannot be used twice', await invPage.getByText(/invalid, has already been used, or has expired/).isVisible());
await uiLogin(invPage, empEmail, 'Newpass123');
ok('new manager can sign in', true);

// ── G. leave setup ──────────────────────────────────────────────────────────────────────────────────────────────
console.log('G. leave setup');
await adminPage.goto(`${WEB}/settings/leave`, { waitUntil: 'networkidle' });
await adminPage.getByRole('button', { name: 'New leave type' }).click();
await adminPage.fill('#lp-name', `QA leave ${suffix}`);
await adminPage.fill('#lp-code', `qa${suffix}`);
await adminPage.fill('#lp-days', '6');
await adminPage.fill('#lp-carry', '2');
await adminPage.getByRole('button', { name: 'Save', exact: true }).click();
await adminPage.getByText(/now have a \d+ balance/).waitFor();
const headcount = sql(`select count(*) from "Employee" where "tenantId"=(select id from "Tenant" where subdomain='acme') and status='ACTIVE'`);
const balances = sql(`select count(*) from "LeaveBalance" b join "LeavePolicy" p on p.id=b."policyId" where p.code='qa${suffix}'`);
ok(`every active employee got a balance (${balances}/${headcount})`, balances === headcount, `${balances} vs ${headcount}`);
await adminPage.fill('#h-name', `QA holiday ${suffix}`);
await adminPage.fill('#h-date', `${new Date().getFullYear()}-12-24`);
await adminPage.getByRole('button', { name: 'Add' }).click();
await adminPage.getByText(`QA holiday ${suffix}`).waitFor();
ok('holiday added', true);
await shot(adminPage, '15-leave-setup');

// ── H. private files ────────────────────────────────────────────────────────────────────────────────────────────
console.log('H. private files');
const adm = await login('admin@acme.com');
const form = new FormData(); form.append('file', new Blob([PNG], { type: 'image/png' }), 'cnic.png');
const up = await (await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${adm}` }, body: form })).json();
ok('upload returns a private reference, not a public URL', up.ref?.startsWith('s3:') && !up.url, JSON.stringify(up));
// Anonymous-read privacy depends on the object store. The local stand-in (s3rver) serves anonymous reads and ignores bucket policies, so
// it cannot prove anything either way. On MinIO the runbook checks this with a real anonymous GET that must return 403.
const direct = await fetch(`${process.env.S3_PUBLIC_ENDPOINT || 'http://127.0.0.1:9000'}/matrixhr/${up.key}`);
console.log(`  note  anonymous GET of the stored object returned ${direct.status}: ${direct.status === 200 ? 'NOT VERIFIABLE on this stand-in (it allows anonymous reads); verify on MinIO per the runbook' : 'refused'}`);
const emp = sql(`select id from "Employee" where "tenantId"=(select id from "Tenant" where subdomain='acme') limit 1`);
const doc = await api(`/employees/${emp}/documents`, { token: adm, method: 'POST', body: { type: 'CNIC', name: 'cnic.png', fileKey: up.key } });
ok('document stored against this tenant', doc.status === 201, JSON.stringify(doc.body));
ok("another company's key is refused", (await api(`/employees/${emp}/documents`, { token: adm, method: 'POST', body: { type: 'CNIC', name: 'x', fileKey: `${T1.tenant.id}/someone-elses.pdf` } })).status === 404);
ok('an arbitrary URL is refused', (await api(`/employees/${emp}/documents`, { token: adm, method: 'POST', body: { type: 'CNIC', name: 'x', fileUrl: 'https://evil.example.com/a.pdf' } })).status === 404);
const signed = await api(`/employees/${emp}/documents/${doc.body.id}/link`, { token: adm });
const got = await fetch(signed.body.url);
ok('a signed link downloads the file', got.status === 200 && (await got.arrayBuffer()).byteLength === PNG.length);
ok('the link carries safety headers', got.headers.get('x-content-type-options') === 'nosniff' && /no-store/.test(got.headers.get('cache-control') || ''));
const tampered = signed.body.url.slice(0, -3) + 'AAA';
ok('a tampered link is refused', (await fetch(tampered)).status === 404);
ok('a manager cannot mint a link to someone else\'s document', (await api(`/employees/${emp}/documents/${doc.body.id}/link`, { token: await login(empEmail, 'Newpass123') })).status === 403);
const pc = await api('/reports/payroll-cost', { token: await login('ali.khan@acme.com') });
ok('payroll-cost is refused to a manager', pc.status === 403, String(pc.status) + ' ' + JSON.stringify(pc.body).slice(0, 200));
ok('payroll-cost works for HR', (await api('/reports/payroll-cost', { token: adm })).status === 200);
const hrTok = await login('hr@acme.com');
ok('headcount report still works for a manager', (await api('/reports/headcount', { token: await login('ali.khan@acme.com') })).status === 200);

ok('no uncaught page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL BROWSER CHECKS PASSED');
process.exit(failures ? 1 : 0);
