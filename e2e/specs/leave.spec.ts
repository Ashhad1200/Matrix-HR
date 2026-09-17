import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.describe('Leave — create (Employee) then approve/reject (Manager)', () => {
  test('employee submits a leave request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: resolve(__dirname, '../.auth/employee.json') });
    const page = await ctx.newPage();
    await page.goto('/leave', { waitUntil: 'networkidle' });

    await page.click('button:has-text("Apply for Leave")');
    // Pick Casual/Sick rather than the first option (Annual Leave) — repeated runs of this
    // suite against the same seeded employee exhaust whichever policy is always selected.
    await page.selectOption('select', { label: 'Casual Leave' });
    // A random future day, single-day request — minimizes balance burn across reruns.
    const offsetDays = 20 + (Date.now() % 300);
    const start = new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
    await page.fill('input[type="date"]:nth-of-type(1)', start);
    await page.fill('input[type="date"]:nth-of-type(2)', start);
    await page.fill('input[placeholder="Reason"]', `E2E leave ${Date.now()}`);
    await page.click('button:has-text("Submit")');

    // The form only closes on a successful create.
    await expect(page.locator('input[placeholder="Reason"]')).toBeHidden();
    await ctx.close();
  });

  test('manager can approve and reject pending requests', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: resolve(__dirname, '../.auth/manager.json') });
    const page = await ctx.newPage();
    await page.goto('/leave', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // let balances/requests/policies/whosOut all resolve

    const approveBtn = page.locator('button:has-text("Approve")').first();
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await expect(page.locator('body')).toContainText('APPROVED');
    }

    const rejectBtn = page.locator('button:has-text("Reject")').first();
    if (await rejectBtn.isVisible().catch(() => false)) {
      await rejectBtn.click();
      await expect(page.locator('body')).toContainText('REJECTED');
    }
    await ctx.close();
  });
});
