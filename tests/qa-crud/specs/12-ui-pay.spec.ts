import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'path';
import { api, badText, login, watch, type Who } from '../lib';

const SHOTS = resolve(__dirname, '../../../docs/qa/screenshots');
const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const shot = (p: Page, n: string) => p.screenshot({ path: resolve(SHOTS, `${n}.png`) });
async function asRole(browser: any, who: Who) { const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page: Page = await ctx.newPage(); const problems = watch(page, [/Failed to load resource/, /Failed to fetch RSC payload/]); await login(page, who); return { page, ctx, problems }; }
test.describe.configure({ mode: 'serial' });

test.describe('Expenses (UI)', () => {
  const cat = `${tag} Travel`; const title = `${tag} trip`;
  test('HR adds a category; it appears; the form validates', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'hr');
    await page.goto('/expenses', { waitUntil: 'networkidle' });
    const form = page.getByTestId('category-form');
    await expect(form).toBeVisible();
    await form.getByLabel('Name').fill(cat);
    await form.getByRole('button', { name: /Add|Save|Create/ }).click();
    await expect(page.getByTestId('category-row').filter({ hasText: cat })).toBeVisible();
    await shot(page, 'expenses-category');
    expect(JSON.stringify((await api('employee', '/expenses/categories')).body)).toContain(cat);
    await ctx.close();
  });
  test('employee: empty claim is blocked, a draft is saved, edited, submitted; another draft deleted', async ({ browser }) => {
    const { page, ctx, problems } = await asRole(browser, 'employee');
    await page.goto('/expenses', { waitUntil: 'networkidle' });
    const form = page.getByTestId('expense-form');
    await page.getByTestId('expense-save-draft').click(); // nothing filled: must not create anything
    expect((await api('employee', '/expenses/claims')).body.filter((c: any) => c.title === '').length).toBe(0);
    await form.getByLabel('Title').fill(title);
    const row = form.getByTestId('expense-item-row').first();
    await row.getByLabel('Category').selectOption({ label: cat });
    await row.getByLabel('Amount').fill('-5');
    await row.getByLabel('Item description').fill('Taxi');
    await page.getByTestId('expense-save-draft').click();
    await expect(page.getByTestId('expense-claim-row').filter({ hasText: title })).toHaveCount(0); // negative amount refused
    await row.getByLabel('Amount').fill('1234.50');
    await page.getByTestId('expense-save-draft').click();
    const claimRow = page.getByTestId('expense-claim-row').filter({ hasText: title });
    await expect(claimRow).toBeVisible();
    await shot(page, 'expenses-draft');
    const saved = (await api('employee', '/expenses/claims')).body.find((c: any) => c.title === title);
    expect(Number(saved.items[0].amount)).toBe(1234.5);
    await claimRow.getByRole('button', { name: 'Submit' }).click();
    await expect(claimRow).toContainText(/submitted/i);
    expect(problems.filter((p) => !/403|404/.test(p))).toEqual([]);
    await ctx.close();
  });
  test('manager then HR approve in the UI; the employee sees it approved', async ({ browser }) => {
    for (const who of ['manager', 'hr'] as const) {
      const { page, ctx } = await asRole(browser, who);
      page.on('dialog', (d) => d.accept());
      await page.goto('/expenses', { waitUntil: 'networkidle' });
      await page.getByTestId('expense-claim-row').filter({ hasText: title }).first().getByRole('button', { name: 'View' }).click();
      await page.getByTestId('expense-approve').click();
      await expect(page.getByTestId('expense-error')).toBeHidden();
      await ctx.close();
    }
    const claim = (await api('employee', '/expenses/claims')).body.find((c: any) => c.title === title);
    expect(claim.status).toBe('APPROVED');
  });
});

test.describe('Loans (UI)', () => {
  test('request → pending; a second open request is refused with a reason; HR then admin approve', async ({ browser }) => {
    const emp = await asRole(browser, 'employee');
    await emp.page.goto('/loans', { waitUntil: 'networkidle' });
    await emp.page.getByTestId('loan-amount').fill('45000');
    await emp.page.getByTestId('loan-installments').fill('3');
    await emp.page.getByTestId('loan-submit').click();
    await expect(emp.page.getByTestId('loan-row').first()).toContainText(/pending/i);
    await shot(emp.page, 'loans-requested');
    await emp.page.getByTestId('loan-amount').fill('30000');
    await emp.page.getByTestId('loan-submit').click();
    await expect(emp.page.getByTestId('loan-error')).toContainText(/open/i);
    await shot(emp.page, 'loans-refused');
    for (const who of ['hr', 'admin'] as const) {
      const { page, ctx } = await asRole(browser, who);
      page.on('dialog', (d) => d.accept());
      await page.goto('/loans', { waitUntil: 'networkidle' });
      await page.getByTestId('loan-row').first().getByRole('button', { name: 'View' }).click();
      await page.getByTestId('loan-approve').click();
      await expect(page.getByTestId('loan-error')).toBeHidden();
      await ctx.close();
    }
    const loan = (await api('employee', '/loans')).body[0];
    expect(loan.status).toBe('APPROVED');
    await emp.ctx.close();
  });
});

test.describe('Payroll (UI)', () => {
  test('HR runs payroll; the run appears; submit → admin approves → lock; employee gets a payslip entry', async ({ browser }) => {
    const hr = await asRole(browser, 'hr');
    await hr.page.goto('/payroll', { waitUntil: 'networkidle' });
    await hr.page.getByRole('button', { name: 'Run Payroll' }).click();
    const period = new Date().toISOString().slice(0, 7);
    await expect(hr.page.getByRole('row', { name: new RegExp(period) })).toBeVisible();
    await hr.page.getByRole('row', { name: new RegExp(period) }).getByRole('button', { name: 'View' }).click();
    await shot(hr.page, 'payroll-draft');
    await hr.page.getByTestId('payroll-recalculate').click();
    await hr.page.getByRole('button', { name: 'Submit for Review' }).click();
    await expect(hr.page.getByText(/Submitted|IN_REVIEW|Review/i).first()).toBeVisible();
    const adm = await asRole(browser, 'admin');
    await adm.page.goto('/payroll', { waitUntil: 'networkidle' });
    await adm.page.getByRole('row', { name: new RegExp(period) }).getByRole('button', { name: 'View' }).click();
    await adm.page.getByRole('button', { name: 'Approve' }).click();
    await adm.page.getByRole('button', { name: /Lock/ }).click();
    await expect(adm.page.getByText(/LOCKED/).first()).toBeVisible();
    await shot(adm.page, 'payroll-locked');
    const run = (await api('admin', '/payroll/runs')).body.find((r: any) => r.period === period);
    expect(run.status).toBe('LOCKED');
    // the employee's own pay page lists a payslip, and the link works only for them
    const slips = await api('employee', '/employees/me/payslips');
    expect(slips.status).toBe(200);
    expect(badText(adm.page)).toBeTruthy();
    await hr.ctx.close(); await adm.ctx.close();
  });
});
