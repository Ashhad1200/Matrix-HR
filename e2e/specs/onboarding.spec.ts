import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('Onboarding — task completion', () => {
  test('completing the next task advances progress', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Seed data always includes several employees mid-onboarding with pending tasks.
    const completeBtn = page.locator('button:has-text("Complete Next Task")').first();
    await expect(completeBtn).toBeVisible({ timeout: 10000 });

    const card = completeBtn.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    const before = await card.locator('[style*="width"]').getAttribute('style');
    await completeBtn.click();
    await page.waitForTimeout(1000);
    const after = await card.locator('[style*="width"]').getAttribute('style');
    expect(after).not.toBe(before);
  });
});
