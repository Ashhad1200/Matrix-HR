import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });

test.describe('Marketplace — connect, sync, disconnect', () => {
  test('connecting an app enables sync, then disconnecting reverts it', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'networkidle' });

    const connectBtn = page.locator('button:has-text("Connect"):not([disabled])').first();
    await expect(connectBtn).toBeVisible({ timeout: 10000 });
    // Card's own wrapper div carries "rounded-xl"; CardContent (a descendant, closer to the
    // button) carries "flex-col" too, so that class alone doesn't reliably pick the outer card.
    const initialCard = connectBtn.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    const appName = (await initialCard.locator('p.font-semibold').first().textContent())?.trim();
    expect(appName).toBeTruthy();

    // Re-derive the card by app name for every step below — chaining off `connectBtn` would
    // silently re-match a *different* card once this one's button stops saying "Connect".
    const card = page.locator('div.rounded-xl', { hasText: appName! });

    await connectBtn.click();
    await expect(card.locator('text=Connected')).toBeVisible({ timeout: 10000 });

    await card.locator('button:has-text("Sync Now")').click();
    await page.waitForTimeout(1000); // sync toast/result auto-dismisses after 6s

    // Revert so the suite is idempotent across reruns.
    await card.locator('button:has-text("Disconnect")').click();
    await expect(card.locator('button:has-text("Connect")')).toBeVisible({ timeout: 10000 });
  });
});
