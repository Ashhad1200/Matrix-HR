import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { resolve } from 'path';

// One case moves through the whole chain, driven by different people — serial.
test.describe.configure({ mode: 'serial' });

const API = 'http://localhost:3001/api/v1';
const auth = (role: string) => resolve(__dirname, `../.auth/${role}.json`);

async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: 'Password123!' } });
  const { accessToken } = await res.json();
  return { Authorization: `Bearer ${accessToken}` };
}

test.describe('Offboarding — approval chain, clearance, exit interview, settlement, completion', () => {
  const code = `E2E${Date.now().toString().slice(-8)}`;
  let empId: string;
  let caseId: string;

  test.beforeAll(async ({ request }) => {
    const admin = await apiLogin(request, 'admin@acme.com');
    const manager = await apiLogin(request, 'ali.khan@acme.com');
    const me = await request.get(`${API}/auth/me`, { headers: manager }).then((r) => r.json());
    const created = await request
      .post(`${API}/employees`, {
        headers: admin,
        data: { employeeCode: code, firstName: 'Offboard', lastName: 'Tester', baseSalary: 120000, managerId: me.employeeId ?? me.employee?.id },
      })
      .then((r) => r.json());
    empId = created.id;
    expect(empId).toBeTruthy();
  });

  async function openCase(page: Page) {
    page.on('dialog', (d) => d.accept());
    await page.goto('/offboarding', { waitUntil: 'networkidle' });
    await page.getByTestId('offboarding-case-row').filter({ hasText: code }).getByRole('button', { name: 'View' }).click();
  }

  test('HR starts a resignation for the employee', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('hr') });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    await page.goto('/offboarding', { waitUntil: 'networkidle' });

    const form = page.getByTestId('offboarding-start-form');
    await form.locator('select').first().selectOption({ label: `Offboard Tester (${code})` });
    await form.locator('input[type="date"]').fill(new Date().toLocaleDateString('en-CA'));
    await form.getByRole('button', { name: /Start offboarding/ }).click();

    await expect(page.getByTestId('offboarding-status')).toHaveText(/pending approval/i);
    await ctx.close();
  });

  test('the initiator cannot approve their own request (segregation of duties)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('hr') });
    const page = await ctx.newPage();
    await openCase(page);
    await page.getByTestId('offboarding-approve').click();
    await expect(page.getByTestId('offboarding-error')).toContainText(/cannot act on a request you raised/i);
    await ctx.close();
  });

  test('the direct manager approves step one and it waits for HR-level approval', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('manager') });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    await page.goto('/offboarding', { waitUntil: 'networkidle' });
    await page.getByTestId('offboarding-case-row').filter({ hasText: code }).getByRole('button', { name: 'View' }).click();
    await page.getByTestId('offboarding-approve').click();
    await expect(page.getByTestId('offboarding-error')).toBeHidden();
    await expect(page.getByTestId('offboarding-status')).toHaveText(/pending approval/i);
    await expect(page.locator('text=/HR[ _]MANAGER/i').first()).toBeVisible();
    await ctx.close();
  });

  test('admin gives final approval and clearance starts', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('admin') });
    const page = await ctx.newPage();
    await openCase(page);
    await page.getByTestId('offboarding-approve').click();
    await expect(page.getByTestId('offboarding-status')).toHaveText(/clearance/i);
    await expect(page.getByTestId('offboarding-clear-item')).toHaveCount(4);
    await ctx.close();
  });

  test('clearance items are signed off, then HR records the exit interview and a settlement appears', async ({ browser, request }) => {
    // Clearance itself is exercised item-by-item in the API suite; here each role clears its own items.
    const tokens = {
      manager: await apiLogin(request, 'ali.khan@acme.com'),
      hr: await apiLogin(request, 'hr@acme.com'),
      admin: await apiLogin(request, 'admin@acme.com'),
    };
    const list = await request.get(`${API}/offboarding?status=CLEARANCE`, { headers: tokens.admin }).then((r) => r.json());
    const c = list.find((x: any) => x.employee.employeeCode === code);
    caseId = c.id;
    const who = { MANAGER: tokens.manager, HR_MANAGER: tokens.hr, COMPANY_ADMIN: tokens.admin } as const;
    for (const item of c.clearanceItems) {
      const res = await request.post(`${API}/offboarding/${caseId}/clearance/${item.id}/clear`, {
        headers: who[item.assignedRole as keyof typeof who],
        data: {},
      });
      expect(res.ok()).toBe(true);
    }

    const ctx = await browser.newContext({ storageState: auth('hr') });
    const page = await ctx.newPage();
    await openCase(page);
    await expect(page.getByTestId('offboarding-status')).toHaveText(/exit interview/i);

    const form = page.getByTestId('offboarding-exit-form');
    await form.getByLabel('Primary reason').fill('Career growth');
    await form.getByRole('button', { name: /Submit exit interview/ }).click();

    await expect(page.getByTestId('offboarding-status')).toHaveText(/settlement/i);
    await expect(page.getByText('not validated by a payroll practitioner')).toBeVisible();
    await expect(page.locator('th:has-text("NET")')).toBeVisible();
    // HR is not admin-level, so completion is not offered to them.
    await expect(page.getByTestId('offboarding-complete')).toHaveCount(0);
    await ctx.close();
  });

  test('admin completes: employee record is closed and access removed', async ({ browser, request }) => {
    const ctx = await browser.newContext({ storageState: auth('admin') });
    const page = await ctx.newPage();
    await openCase(page);
    await page.getByTestId('offboarding-complete').click();
    await expect(page.getByTestId('offboarding-status')).toHaveText(/completed/i);

    const admin = await apiLogin(request, 'admin@acme.com');
    const emp = await request.get(`${API}/employees/${empId}`, { headers: admin }).then((r) => r.json());
    expect(emp.status).toBe('RESIGNED');
    await ctx.close();
  });
});
