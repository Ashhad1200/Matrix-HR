import { test, expect } from '@playwright/test';
import { resolve } from 'path';

// Maker-checker means the prepare/submit and approve steps must be different
// people — this whole flow shares one payroll run, so keep it serial.
test.describe.configure({ mode: 'serial' });

test.describe('Payroll — maker-checker run, view, submit, approve, lock', () => {
  const period = new Date().toISOString().slice(0, 7);

  test('admin creates the run, views the breakdown, and submits it for review', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: resolve(__dirname, '../.auth/admin.json') });
    const page = await ctx.newPage();
    await page.goto('/payroll', { waitUntil: 'networkidle' });

    const existingRow = page.locator('tr', { hasText: period });
    if ((await existingRow.count()) === 0) {
      await page.click('button:has-text("Run Payroll")');
      await expect(page.locator('tr', { hasText: period })).toBeVisible({ timeout: 10000 });
    }

    await page.locator('tr', { hasText: period }).locator('button:has-text("View")').click();
    await expect(page.locator(`text=Payroll ${period}`)).toBeVisible();

    // Sanity-check the calculation: net must be less than gross for every row
    // (tax/EOBI/PF > 0), for at least the first few of the 25 seeded employees.
    const rows = page.locator('table').last().locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const cells = await rows.nth(i).locator('td').allTextContents();
      const [, gross, , , , net] = cells;
      const grossNum = Number(gross.replace(/[^0-9.]/g, ''));
      const netNum = Number(net.replace(/[^0-9.]/g, ''));
      expect(netNum).toBeGreaterThan(0);
      expect(netNum).toBeLessThan(grossNum);
    }

    // If a previous failed run left this period mid-flow, it may already be past DRAFT.
    const submitBtn = page.locator('button:has-text("Submit for Review")');
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(page.locator('button:has-text("Approve")')).toBeVisible({ timeout: 5000 });
    }
    await ctx.close();
  });

  test('the preparer cannot approve their own run (maker-checker enforced)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: resolve(__dirname, '../.auth/admin.json') });
    const page = await ctx.newPage();
    await page.goto('/payroll', { waitUntil: 'networkidle' });
    await page.locator('tr', { hasText: period }).locator('button:has-text("View")').click();

    const approveBtn = page.locator('button:has-text("Approve")');
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await expect(page.locator('text=cannot also approve it')).toBeVisible({ timeout: 5000 });
    }
    await ctx.close();
  });

  test('a different approver (HR) can approve and lock, generating a real payslip PDF', async ({ browser, request }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'hr@acme.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await page.goto('/payroll', { waitUntil: 'networkidle' });
    await page.locator('tr', { hasText: period }).locator('button:has-text("View")').click();

    await page.click('button:has-text("Approve")');
    await expect(page.locator('button:has-text("Lock")')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Lock")');
    await expect(page.locator('text=View PDF').first()).toBeVisible({ timeout: 10000 });

    // Verify the generated payslip is a real PDF, not a placeholder — fetched
    // directly via the API rather than chasing a `window.open` popup, which
    // is unreliable to capture in headless automation.
    const API = 'http://localhost:3001/api/v1';
    const login = await request.post(`${API}/auth/login`, { data: { email: 'hr@acme.com', password: 'Password123!' } });
    const { accessToken } = await login.json();
    const auth = { Authorization: `Bearer ${accessToken}` };

    const runs = await request.get(`${API}/payroll/runs`, { headers: auth }).then((r) => r.json());
    const run = runs.find((r: any) => r.period === period);
    const runDetail = await request.get(`${API}/payroll/runs/${run.id}`, { headers: auth }).then((r) => r.json());
    expect(runDetail.status).toBe('LOCKED');
    expect(runDetail.items.every((i: any) => !!i.payslipUrl)).toBe(true);

    const pdfRes = await request.get(runDetail.items[0].payslipUrl);
    expect(pdfRes.ok()).toBe(true);
    expect(pdfRes.headers()['content-type']).toContain('application/pdf');
    const body = await pdfRes.body();
    expect(body.slice(0, 4).toString()).toBe('%PDF');

    await ctx.close();
  });
});
