import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/employee.json') });

test.describe('Attendance — clock in/out', () => {
  test('clock in and out follow the daily state machine correctly', async ({ page }) => {
    await page.goto('/attendance', { waitUntil: 'networkidle' });

    const clockIn = page.locator('button:has-text("Clock In")');
    const clockOut = page.locator('button:has-text("Clock Out")');

    if (await clockIn.isEnabled()) {
      await clockIn.click();
      await expect(clockIn).toBeDisabled({ timeout: 5000 });
      await expect(clockOut).toBeEnabled();
      await clockOut.click();
      await expect(clockOut).toBeDisabled({ timeout: 5000 });
    } else {
      // Already clocked in today (idempotency guard) — both actions should be locked out correctly.
      await expect(clockIn).toBeDisabled();
      await expect(clockOut).toBeDisabled();
    }
  });
});
