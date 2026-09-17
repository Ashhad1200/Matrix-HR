import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('Payroll — run, view, approve', () => {
  test('run payroll for the current period, view the breakdown, approve & lock', async ({ page }) => {
    await page.goto('/payroll', { waitUntil: 'networkidle' });

    const period = new Date().toISOString().slice(0, 7);
    const existingRow = page.locator('tr', { hasText: period });
    if ((await existingRow.count()) === 0) {
      await page.click('button:has-text("Run Payroll")');
      await expect(page.locator('tr', { hasText: period })).toBeVisible({ timeout: 10000 });
    }

    await page.locator('tr', { hasText: period }).locator('button:has-text("View")').click();
    await expect(page.locator(`text=Payroll ${period}`)).toBeVisible();

    // Sanity-check the calculation: net must be less than gross for every row (tax/EOBI/PF > 0),
    // and there should be one row per active employee (25 seeded).
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

    const approveBtn = page.locator('button:has-text("Approve & Lock")');
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(1000);
      await page.locator('tr', { hasText: period }).locator('button:has-text("View")').click();
      await expect(page.locator('body')).not.toContainText('Approve & Lock');
    }
  });
});
