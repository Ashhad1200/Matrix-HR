import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.describe('Timesheets — projects (Admin) + entries (Employee)', () => {
  test('admin creates a project', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: resolve(__dirname, '../.auth/admin.json') });
    const page = await ctx.newPage();
    await page.goto('/timesheets', { waitUntil: 'networkidle' });

    const stamp = Date.now().toString().slice(-5);
    await page.click('button:has-text("New Project")');
    await page.waitForTimeout(300);
    await page.fill('input[placeholder="MTX"]', `E${stamp}`);
    await page.fill('input[placeholder="Matrix Platform"]', `E2E Project ${stamp}`);
    await page.locator('[role="dialog"]:has-text("New Project") button:has-text("Create")').click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
    await ctx.close();
  });

  test('employee logs, sees, and deletes a draft time entry', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: resolve(__dirname, '../.auth/employee.json') });
    const page = await ctx.newPage();
    await page.goto('/timesheets', { waitUntil: 'networkidle' });

    let createdId = '';
    page.on('response', async (res) => {
      if (res.url().includes('/timesheets/entries') && res.request().method() === 'POST' && res.ok()) {
        createdId = (await res.json().catch(() => ({}))).id ?? '';
      }
    });

    const noteText = `E2E entry ${Date.now()}`;
    await page.click('button:has-text("Log Hours")');
    await page.waitForTimeout(300);
    await page.locator('input[type="number"]').fill('2');
    await page.locator('input[placeholder="What did you work on?"]').fill(noteText);
    await page.locator('[role="dialog"]:has-text("Log Hours") button:has-text("Save Entry")').click();
    await page.waitForTimeout(1000);
    expect(createdId, 'entry should have been created (POST /timesheets/entries succeeded)').toBeTruthy();

    // The note is rendered on the day card.
    await expect(page.locator('body')).toContainText(noteText.length > 20 ? noteText.slice(0, 20) : noteText);

    // Delete control only shows on hover, only for draft entries.
    const entryRow = page.locator('main .group', { hasText: 'Draft' }).filter({ hasText: noteText.slice(0, 15) }).last();
    await entryRow.hover();
    let deleteOk = false;
    page.once('response', (res) => {
      if (res.url().includes(`/timesheets/entries/${createdId}`) && res.request().method() === 'DELETE') deleteOk = res.ok();
    });
    await entryRow.locator('button[aria-label="Delete entry"]').click();
    await page.waitForTimeout(800);
    expect(deleteOk).toBe(true);
    await ctx.close();
  });
});
