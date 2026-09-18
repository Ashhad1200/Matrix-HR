import { test, expect, type APIRequestContext } from '@playwright/test';
import { resolve } from 'path';

test.use({ storageState: resolve(__dirname, '../.auth/admin.json') });
test.describe.configure({ mode: 'serial' });

const ORIGIN = 'http://localhost:3001';
const API = `${ORIGIN}/api/v1`;

async function adminHeaders(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, { data: { email: 'admin@acme.com', password: 'Password123!' } });
  const { accessToken } = await res.json();
  return { Authorization: `Bearer ${accessToken}` };
}

test.describe('Webhooks — create, one-time secret, failing delivery is retried and visible', () => {
  const url = `http://host.docker.internal:9/e2e-${Date.now()}`; // port 9: connection refused -> failure path

  test('create shows the signing secret once, then a failed test delivery is queued for retry', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('/settings/webhooks', { waitUntil: 'networkidle' });

    const form = page.getByTestId('webhook-form');
    await form.getByLabel('Endpoint URL').fill(url);
    await form.getByRole('checkbox').first().check();
    await form.getByRole('button', { name: 'Create webhook' }).click();

    await expect(page.getByTestId('webhook-secret')).toBeVisible();
    await expect(page.getByTestId('webhook-secret')).toContainText(/will not be shown again/i);

    const row = page.getByTestId('webhook-row').filter({ hasText: url });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('webhook-health')).toHaveText(/healthy/i);

    await row.getByTestId('webhook-test').click();
    await expect(page.getByTestId('delivery-row').first()).toContainText(/retrying/i, { timeout: 15000 });
    await expect(row.getByTestId('webhook-health')).toHaveText(/degraded/i);

    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('webhook-row').filter({ hasText: url })).toHaveCount(0);
  });
});

test.describe('Biometric devices — register, go online after a push, remove', () => {
  const sn = `E2E${Date.now().toString().slice(-9)}`;

  test.beforeAll(async ({ request }) => {
    await request.post(`${API}/marketplace/zkteco/connect`, { headers: await adminHeaders(request) });
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API}/marketplace/zkteco/disconnect`, { headers: await adminHeaders(request) });
  });

  test('admin registers a terminal and sees it come online once it calls in', async ({ page, request }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('/settings/devices', { waitUntil: 'networkidle' });

    const form = page.getByTestId('device-form');
    await form.getByLabel('Serial number').fill(sn);
    await form.getByLabel('Name', { exact: true }).fill('E2E terminal');
    await form.getByRole('button', { name: 'Register device' }).click();

    const row = page.getByTestId('device-row').filter({ hasText: sn });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/offline/i);

    const hs = await request.get(`${ORIGIN}/iclock/cdata?SN=${sn}&options=all`);
    expect(hs.ok()).toBe(true);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('device-row').filter({ hasText: sn })).toContainText(/online/i);

    await page.getByTestId('device-row').filter({ hasText: sn }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('device-row').filter({ hasText: sn })).toHaveCount(0);
  });
});

test.describe('Payroll exports — validated bank file and QuickBooks journal', () => {
  test('bank file reports what it excluded; journal needs QuickBooks, then balances', async ({ page, request }) => {
    const headers = await adminHeaders(request);
    await request.post(`${API}/marketplace/quickbooks/disconnect`, { headers });

    await page.goto('/payroll', { waitUntil: 'networkidle' });
    await page.locator('tr', { hasText: 'APPROVED' }).first().getByRole('button', { name: 'View' }).click();

    await page.getByTestId('bank-file-generate').click();
    await expect(page.getByText(/not yet confirmed/i)).toBeVisible();
    // The demo admin/HR users have no bank details, so they must be reported, never silently dropped.
    await expect(page.getByTestId('bank-file-excluded')).toBeVisible();

    await page.getByTestId('journal-export').click();
    await expect(page.getByText(/QuickBooks is not connected/i)).toBeVisible();

    await request.post(`${API}/marketplace/quickbooks/connect`, { headers });
    await page.getByTestId('journal-export').click();
    await expect(page.getByText(/balanced/i).first()).toBeVisible();

    await request.post(`${API}/marketplace/quickbooks/disconnect`, { headers });
  });
});
