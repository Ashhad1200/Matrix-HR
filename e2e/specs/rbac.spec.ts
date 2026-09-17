import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/employee.json') });

test.describe('RBAC — frontend route guard', () => {
  for (const path of ['/payroll', '/settings', '/employees', '/reports']) {
    test(`employee is redirected away from ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }

  test('employee sees only their own portal nav', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const nav = page.locator('aside');
    await expect(nav).toContainText('My Info');
    await expect(nav).not.toContainText('Settings');
  });
});
