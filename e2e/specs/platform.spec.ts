import { test, expect } from '@playwright/test';

// All three tests mutate the same tenant's subscription — fullyParallel would
// otherwise race them against each other. Force this file to run in order.
test.describe.configure({ mode: 'serial' });

test.describe('Platform — commercial back office (SUPER_ADMIN only)', () => {
  test('super admin can view, downgrade, and restore a tenant plan', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'superadmin@acme.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.goto('/platform', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/platform$/); // not redirected away
    await page.locator('a:has-text("Acme Software")').first().click();
    await page.waitForURL(/\/platform\/.+/, { timeout: 10000 });

    await expect(page.locator('text=Resolved Entitlements')).toBeVisible();
    const before = await page.locator('text=/Resolved Entitlements \\(\\d+\\)/').textContent();

    await page.click('button:has-text("Growth")');
    await page.waitForTimeout(1000);
    const during = await page.locator('text=/Resolved Entitlements \\(\\d+\\)/').textContent();
    expect(during).not.toBe(before);

    // Always restore to Enterprise — every other spec assumes the full feature set.
    await page.click('button:has-text("Enterprise")');
    await page.waitForTimeout(1000);
    const after = await page.locator('text=/Resolved Entitlements \\(\\d+\\)/').textContent();
    expect(after).toBe(before);
  });

  test('non-super-admin roles cannot reach /platform', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@acme.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.goto('/platform', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/dashboard$/);
    await ctx.close();
  });

  test('downgrading a plan actually blocks a gated endpoint, at the API', async ({ request }) => {
    // baseURL is the web app (localhost:3000); the API is a separate origin, so full URLs here.
    const API = 'http://localhost:3001/api/v1';

    const superLogin = await request.post(`${API}/auth/login`, {
      data: { email: 'superadmin@acme.com', password: 'Password123!' },
    });
    const { accessToken: superToken, user: superUser } = await superLogin.json();

    const adminLogin = await request.post(`${API}/auth/login`, {
      data: { email: 'admin@acme.com', password: 'Password123!' },
    });
    const { accessToken: adminToken } = await adminLogin.json();

    const tenantId = superUser.tenantId;
    const authSuper = { Authorization: `Bearer ${superToken}` };
    const authAdmin = { Authorization: `Bearer ${adminToken}` };

    const before = await request.get(`${API}/sso/config`, { headers: authAdmin });
    expect(before.ok()).toBe(true);

    const downgrade = await request.post(`${API}/platform/tenants/${tenantId}/subscription`, {
      headers: authSuper,
      data: { planCode: 'starter' },
    });
    expect(downgrade.ok()).toBe(true);

    const blocked = await request.get(`${API}/sso/config`, { headers: authAdmin });
    expect(blocked.status()).toBe(403);

    // Restore — required for every other test/demo session.
    const restore = await request.post(`${API}/platform/tenants/${tenantId}/subscription`, {
      headers: authSuper,
      data: { planCode: 'enterprise' },
    });
    expect(restore.ok()).toBe(true);

    const restored = await request.get(`${API}/sso/config`, { headers: authAdmin });
    expect(restored.ok()).toBe(true);
  });
});
