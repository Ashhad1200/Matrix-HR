import { test, expect, type APIRequestContext } from '@playwright/test';
import { resolve } from 'path';
import { execFileSync } from 'child_process';

test.describe.configure({ mode: 'serial' });

const API = 'http://localhost:3001/api/v1';
const auth = (role: string) => resolve(__dirname, `../.auth/${role}.json`);
const stamp = Date.now();
const catName = `E2E Travel ${stamp}`;
const claimTitle = `E2E trip ${stamp}`;

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'matrixhr-postgres', 'psql', '-U', 'matrixhr', '-d', 'matrixhr', '-tAc', sql]).toString();

// An approved loan can't be cancelled by design, so this spec removes its own footprint before and after.
const clearSaraLoans = () => {
  psql(`delete from "CompensationItem" where "sourceType"='LoanRequest' and "employeeId" in (select "employeeId" from "User" where email='sara.ahmed@acme.com')`);
  psql(`delete from "LoanRequest" where "employeeId" in (select "employeeId" from "User" where email='sara.ahmed@acme.com')`);
};

async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: 'Password123!' } });
  return { Authorization: `Bearer ${(await res.json()).accessToken}` };
}

test.describe('Expenses — claim, manager then HR approval', () => {
  // An approved claim would be reimbursed in the next real payroll run, so retire this spec's claims.
  test.afterAll(() => {
    psql(`update "ExpenseClaim" set status='CANCELLED' where title='${claimTitle}' and status in ('APPROVED','SUBMITTED','DRAFT')`);
  });

  test.beforeAll(async ({ request }) => {
    const hr = await apiLogin(request, 'hr@acme.com');
    const res = await request.post(`${API}/expenses/categories`, { headers: hr, data: { name: catName } });
    expect(res.status()).toBe(201);
  });

  test('an employee files and submits a claim', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('employee') });
    const page = await ctx.newPage();
    await page.goto('/expenses', { waitUntil: 'networkidle' });

    const form = page.getByTestId('expense-form');
    await form.getByLabel('Title').fill(claimTitle);
    const row = form.getByTestId('expense-item-row').first();
    await row.getByLabel('Category').selectOption({ label: catName });
    await row.getByLabel('Amount').fill('1234.50');
    await row.getByLabel('Item description').fill('Taxi to client');
    await page.getByTestId('expense-save-draft').click();

    const claimRow = page.getByTestId('expense-claim-row').filter({ hasText: claimTitle });
    await expect(claimRow).toBeVisible();
    await claimRow.getByRole('button', { name: 'Submit' }).click();
    await expect(claimRow).toContainText(/submitted/i);
    await ctx.close();
  });

  test('the manager approves first, HR second, and the employee sees it approved', async ({ browser }) => {
    for (const role of ['manager', 'hr'] as const) {
      const ctx = await browser.newContext({ storageState: auth(role === 'hr' ? 'hr' : 'manager') });
      const page = await ctx.newPage();
      page.on('dialog', (d) => d.accept());
      await page.goto('/expenses', { waitUntil: 'networkidle' });
      const inboxRow = page.getByTestId('expense-claim-row').filter({ hasText: claimTitle }).first();
      await inboxRow.getByRole('button', { name: 'View' }).click();
      await page.getByTestId('expense-approve').click();
      await expect(page.getByTestId('expense-error')).toBeHidden();
      await ctx.close();
    }

    const ctx = await browser.newContext({ storageState: auth('employee') });
    const page = await ctx.newPage();
    await page.goto('/expenses', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('expense-claim-row').filter({ hasText: claimTitle })).toContainText(/approved/i);
    await ctx.close();
  });
});

test.describe('Loans — request, HR then admin approval, schedule', () => {
  test.beforeAll(() => clearSaraLoans());
  test.afterAll(() => clearSaraLoans());

  test('an employee requests a 3-instalment loan', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('employee') });
    const page = await ctx.newPage();
    await page.goto('/loans', { waitUntil: 'networkidle' });

    await page.getByTestId('loan-amount').fill('45000');
    await page.getByTestId('loan-installments').fill('3');
    await page.getByTestId('loan-submit').click();
    await expect(page.getByTestId('loan-row').first()).toContainText(/pending/i);
    await expect(page.getByTestId('loan-error')).toBeHidden();
    await ctx.close();
  });

  test('a second open loan is refused with the server\'s reason', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth('employee') });
    const page = await ctx.newPage();
    await page.goto('/loans', { waitUntil: 'networkidle' });
    await page.getByTestId('loan-amount').fill('30000');
    await page.getByTestId('loan-installments').fill('3');
    await page.getByTestId('loan-submit').click();
    await expect(page.getByTestId('loan-error')).toContainText(/already have an open/i);
    await ctx.close();
  });

  test('HR then the admin approve; the schedule has three instalments', async ({ browser }) => {
    for (const role of ['hr', 'admin'] as const) {
      const ctx = await browser.newContext({ storageState: auth(role) });
      const page = await ctx.newPage();
      page.on('dialog', (d) => d.accept());
      await page.goto('/loans', { waitUntil: 'networkidle' });
      await page.getByTestId('loan-row').first().getByRole('button', { name: 'View' }).click();
      await page.getByTestId('loan-approve').click();
      await expect(page.getByTestId('loan-error')).toBeHidden();
      if (role === 'admin') {
        await expect(page.getByTestId('loan-status')).toHaveText(/approved/i);
        await expect(page.getByTestId('loan-schedule-row')).toHaveCount(3);
      }
      await ctx.close();
    }
  });
});
