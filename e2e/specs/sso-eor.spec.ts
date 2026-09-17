import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('SSO settings — save config', () => {
  test('toggling and saving SSO config persists', async ({ page }) => {
    await page.goto('/settings/sso', { waitUntil: 'networkidle' });

    const entryPoint = page.locator('input[placeholder*="okta.com/app"]');
    const stamp = Date.now().toString().slice(-6);
    await entryPoint.fill(`https://e2e-test-${stamp}.okta.com/app/sso/saml`);
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    await page.reload({ waitUntil: 'networkidle' });
    await expect(entryPoint).toHaveValue(`https://e2e-test-${stamp}.okta.com/app/sso/saml`);
  });
});

test.describe('EOR — cost calculator', () => {
  test('getting a quote returns a sane cost breakdown', async ({ page }) => {
    await page.goto('/settings/eor', { waitUntil: 'networkidle' });

    await page.fill('input[type="number"]', '2000');
    await page.click('button:has-text("Get Quote")');
    await expect(page.locator('text=Total / month')).toBeVisible({ timeout: 5000 });

    const body = await page.locator('body').innerText();
    expect(body).toContain('Gross salary');
    expect(body).toContain('Employer costs');
    expect(body).toContain('EOR fee');
  });
});
