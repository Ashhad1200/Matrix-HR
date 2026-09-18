import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { totpAt } from '../../apps/api/src/auth/totp';

test.describe.configure({ mode: 'serial' });

const API = 'http://localhost:3001/api/v1';
const stamp = Date.now();
const email = `e2eauth${stamp}@example.com`;
let password = 'Str0ngPass1';

async function signup(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/signup`, {
    data: { email, password, companyName: `E2E Auth ${stamp}`, subdomain: `e2e-auth-${stamp}` },
  });
  expect(res.status()).toBe(201);
}

async function uiLogin(page: Page, pw: string) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.click('button[type="submit"]');
}

async function seedAdminOutboxToken(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, { data: { email: 'admin@acme.com', password: 'Password123!' } });
  const { accessToken } = await login.json();
  const box = await request.get(`${API}/dev/outbox`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
  return (box as any[]).find((m) => m.to === email)?.text.match(/token=([a-f0-9]+)/)?.[1] as string | undefined;
}

test.describe('Auth — reset, change password, MFA, session refresh, error pages', () => {
  test.beforeAll(async ({ request }) => {
    await signup(request);
  });

  test('forgot-password gives the same neutral answer for any email', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle' });
    await page.getByTestId('forgot-email').fill(`nobody${stamp}@example.com`);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-confirmation')).toContainText(/if an account exists/i);
  });

  test('a reset link sets a new password, works once, and the new password logs in', async ({ page, request }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle' });
    await page.getByTestId('forgot-email').fill(email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-confirmation')).toBeVisible();

    const token = await seedAdminOutboxToken(request);
    expect(token).toBeTruthy();

    await page.goto(`/reset-password?token=${token}`, { waitUntil: 'networkidle' });
    await page.getByTestId('reset-password-input').fill('weak');
    await page.getByTestId('reset-confirm-input').fill('weak');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-success')).toHaveCount(0); // weak password never reaches success

    password = 'Reset1Pass9';
    await page.getByTestId('reset-password-input').fill(password);
    await page.getByTestId('reset-confirm-input').fill(password);
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-success')).toBeVisible();

    // single use
    await page.goto(`/reset-password?token=${token}`, { waitUntil: 'networkidle' });
    await page.getByTestId('reset-password-input').fill('Another1Pass');
    await page.getByTestId('reset-confirm-input').fill('Another1Pass');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-success')).toHaveCount(0);

    await uiLogin(page, password);
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('an expired access token is refreshed transparently instead of logging the user out', async ({ page }) => {
    await uiLogin(page, password);
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.evaluate(() => localStorage.setItem('accessToken', 'garbage.expired.token'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/dashboard/);
    const stored = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(stored).not.toBe('garbage.expired.token');
  });

  test('change password from the Security page', async ({ page }) => {
    await uiLogin(page, password);
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('/security', { waitUntil: 'networkidle' });
    const form = page.getByTestId('security-change-password');
    const fields = form.locator('input[type="password"]');
    const next = 'Changed1Pass';
    await fields.nth(0).fill(password);
    await fields.nth(1).fill(next);
    await fields.nth(2).fill(next);
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText(/other devices were signed out/i)).toBeVisible();
    password = next;
  });

  test('enabling MFA shows recovery codes once, and login then demands a code', async ({ page }) => {
    await uiLogin(page, password);
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('/security', { waitUntil: 'networkidle' });

    await page.getByTestId('mfa-setup-start').click();
    const secret = ((await page.getByTestId('mfa-secret').innerText()).match(/[A-Z2-7]{32}/) ?? [])[0];
    expect(secret).toBeTruthy();

    await page.getByTestId('mfa-enable-code').fill(totpAt(secret!, Date.now()));
    await page.getByTestId('mfa-enable-submit').click();
    await expect(page.getByTestId('mfa-recovery-codes')).toBeVisible();
    expect(((await page.getByTestId('mfa-recovery-codes').innerText()).match(/[A-Z2-9]{5}-[A-Z2-9]{5}/g) ?? []).length).toBe(8);
    await page.getByTestId('mfa-saved-checkbox').check();

    // Sign out (clear the client session), then log in again: password alone must no longer be enough.
    await page.evaluate(() => { localStorage.clear(); });
    await uiLogin(page, password);
    await expect(page.getByTestId('mfa-code-input')).toBeVisible();
    await expect(page).not.toHaveURL(/dashboard/);

    await page.getByTestId('mfa-code-input').fill('000000');
    await page.getByTestId('mfa-verify').click();
    await expect(page.getByTestId('login-error')).toBeVisible();

    // The code from the enrolment step was already used, so use the next window's code (accepted: ±1 step).
    await page.getByTestId('mfa-code-input').fill(totpAt(secret!, Date.now() + 30_000));
    await page.getByTestId('mfa-verify').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('unknown pages show a friendly 404 with no internals; security headers are set', async ({ page }) => {
    const res = await page.goto('/definitely-not-a-page');
    expect(res?.status()).toBe(404);
    await expect(page.locator('body')).not.toContainText(/stack|at .*\.tsx?:\d+|node_modules/i);
    const headers = res!.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
