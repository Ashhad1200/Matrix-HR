import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('Employees — full CRUD (Admin)', () => {
  const stamp = Date.now().toString().slice(-6);
  const fullName = `Crud Test${stamp}`;

  test('create, read, and update an employee', async ({ page }) => {
    await page.goto('/employees', { waitUntil: 'networkidle' });

    // CREATE
    await page.click('button:has-text("Add Employee")');
    await page.fill('input[placeholder="Employee Code"]', `CRUD${stamp}`);
    await page.fill('input[placeholder="Email"]', `crud.test.${stamp}@acme.com`);
    await page.fill('input[placeholder="First Name"]', 'Crud');
    await page.fill('input[placeholder="Last Name"]', `Test${stamp}`);
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder="Search employees..."]', `CRUD${stamp}`);
    await expect(page.locator(`text=CRUD${stamp}`).first()).toBeVisible({ timeout: 10000 });

    // READ
    await page.locator(`text=${fullName}`).first().click();
    await expect(page.locator('h1')).toContainText(fullName);

    // UPDATE
    await page.click('button:has-text("Edit")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').nth(3).fill('+92-300-5551234'); // Phone
    await dialog.locator('select').selectOption('SUSPENDED');
    await dialog.locator('button:has-text("Save Changes")').click();
    await expect(dialog).toBeHidden();

    await expect(page.locator('body')).toContainText('+92-300-5551234');
    await expect(page.locator('body')).toContainText('SUSPENDED');
  });

  test('no delete affordance exists for employees (by design)', async ({ page }) => {
    await page.goto('/employees', { waitUntil: 'networkidle' });
    await expect(page.locator('button:has-text("Delete")')).toHaveCount(0);
  });
});
