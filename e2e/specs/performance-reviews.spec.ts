import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('Performance Reviews — create then submit', () => {
  test('create a manager review and submit it with a rating', async ({ page }) => {
    await page.goto('/performance/reviews', { waitUntil: 'networkidle' });

    await page.click('button:has-text("New Review")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const cycleSelect = dialog.locator('select').nth(0);
    const employeeSelect = dialog.locator('select').nth(1);
    const reviewerSelect = dialog.locator('select').nth(2);
    await cycleSelect.selectOption({ index: 1 });
    await employeeSelect.selectOption({ index: 1 });
    await reviewerSelect.selectOption({ index: 2 }); // different person than the employee

    await dialog.locator('button:has-text("Create")').click();
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Write & submit the review we just created (it starts "pending").
    const writeBtn = page.locator('button:has-text("Write Review")').first();
    await expect(writeBtn).toBeVisible({ timeout: 5000 });
    await writeBtn.click();

    const editDialog = page.locator('[role="dialog"]', { hasText: 'Write Review' });
    await expect(editDialog).toBeVisible();
    await editDialog.locator('button[aria-label="4 stars"]').click();
    await editDialog.locator('textarea').fill('E2E: strong quarter, clear communication.');
    await editDialog.locator('button:has-text("Submit Review")').click();
    await expect(editDialog).toBeHidden({ timeout: 5000 });
  });
});
