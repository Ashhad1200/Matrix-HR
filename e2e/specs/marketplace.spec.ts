import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('Marketplace — honest catalog, connect, disconnect', () => {
  test('stubs are labelled planned and cannot be connected; real integrations are beta', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'networkidle' });

    const okta = page.getByTestId('marketplace-card').filter({ hasText: 'Okta' });
    await expect(okta.getByTestId('marketplace-maturity')).toHaveText(/planned/i);
    await expect(okta.getByRole('button', { name: /^Connect$/ })).toHaveCount(0);

    const zk = page.getByTestId('marketplace-card').filter({ hasText: 'ZKTeco' });
    await expect(zk.getByTestId('marketplace-maturity')).toHaveText(/beta/i);
    const qb = page.getByTestId('marketplace-card').filter({ hasText: 'QuickBooks' });
    await expect(qb.getByTestId('marketplace-maturity')).toHaveText(/beta/i);

    // The old simulated "Sync Now" button must be gone everywhere.
    await expect(page.getByRole('button', { name: /Sync Now/i })).toHaveCount(0);
  });

  test('connecting a beta integration works and disconnecting reverts it', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'networkidle' });
    const card = page.getByTestId('marketplace-card').filter({ hasText: 'QuickBooks' });

    await card.getByRole('button', { name: /^Connect$/ }).click();
    await expect(card.getByRole('button', { name: /Connected/ })).toBeVisible({ timeout: 10000 });
    await card.getByRole('button', { name: 'View log' }).click();
    await expect(card.getByTestId('marketplace-log-panel')).toBeVisible();

    // Revert so the suite is idempotent across reruns.
    await card.getByRole('button', { name: 'Disconnect' }).click();
    await expect(card.getByRole('button', { name: /^Connect$/ })).toBeVisible({ timeout: 10000 });
  });
});
