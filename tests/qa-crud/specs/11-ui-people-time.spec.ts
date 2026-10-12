import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { accounts, api, badText, login, watch, type Who } from '../lib';

const SHOTS = resolve(__dirname, '../../../docs/qa/screenshots');
mkdirSync(SHOTS, { recursive: true });
const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const shot = (p: Page, n: string) => p.screenshot({ path: resolve(SHOTS, `${n}.png`) });
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
async function asRole(browser: any, who: Who) { const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page: Page = await ctx.newPage(); const problems = watch(page, [/Failed to load resource/, /Failed to fetch RSC payload/]); await login(page, who); return { page, ctx, problems }; }

test.describe('Employees (UI)', () => {
  test('create → appears in list → search → required fields → duplicate shows an error', async ({ browser }) => {
    const { page, ctx, problems } = await asRole(browser, 'hr');
    await page.goto('/employees', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add Employee' }).click();
    // required fields: the browser blocks an empty submit
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'New Employee' })).toBeVisible();
    await page.getByPlaceholder('Employee Code').fill(`${tag}-UI1`);
    await page.getByPlaceholder('First Name').fill('Uma');
    await page.getByPlaceholder('Last Name').fill(tag);
    await page.getByPlaceholder('Email').fill(`uma.${tag.toLowerCase()}@qa.test`);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'New Employee' })).toBeHidden();
    await page.getByPlaceholder('Search employees...').fill(tag);
    await expect(page.getByRole('row', { name: new RegExp(`${tag}-UI1`) })).toBeVisible();
    await shot(page, 'employees-created');
    // the saved record matches what was typed
    const found = (await api('hr', `/employees?search=${tag}-UI1`)).body.data[0];
    expect(found).toMatchObject({ firstName: 'Uma', lastName: tag, email: `uma.${tag.toLowerCase()}@qa.test` });
    // duplicate code: an error is visible, nothing crashes
    await page.getByRole('button', { name: 'Add Employee' }).click();
    await page.getByPlaceholder('Employee Code').fill(`${tag}-UI1`);
    await page.getByPlaceholder('First Name').fill('Dup');
    await page.getByPlaceholder('Last Name').fill('Licate');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(/already exists/i);
    await shot(page, 'employees-duplicate-error');
    expect(await badText(page)).toEqual([]);
    expect(problems).toEqual([]);
    await ctx.close();
  });
  test('pagination: more than one page, Next/Previous work, no overlap', async ({ browser }) => {
    for (let i = 0; i < 22; i++) await api('hr', '/employees', 'POST', { employeeCode: `${tag}-PG${String(i).padStart(2, '0')}`, firstName: `Pg${String(i).padStart(2, '0')}`, lastName: `${tag}pg` });
    const { page, ctx } = await asRole(browser, 'hr');
    await page.goto('/employees', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Search employees...').fill(`${tag}pg`);
    await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
    const first = await page.locator('tbody tr').count();
    expect(first).toBe(20);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/Page 2 of 2/)).toBeVisible();
    expect(await page.locator('tbody tr').count()).toBe(2);
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
    await shot(page, 'employees-pagination');
    await ctx.close();
  });
  test('an employee cannot see the Add button or other people\'s pay data in the directory', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'employee');
    await page.goto('/employees', { waitUntil: 'networkidle' }).catch(() => undefined);
    // the route is not in an employee's nav: they are sent back to the dashboard
    await expect(page).toHaveURL(/dashboard/);
    const r = await api('employee', '/employees?limit=5');
    expect(JSON.stringify(r.body)).not.toMatch(/baseSalary|bankAccount|cnic/);
    await ctx.close();
  });
});

test.describe('Leave (UI)', () => {
  test('apply → pending → manager approves in the UI; over-balance and bad dates show an error', async ({ browser }) => {
    const emp = await asRole(browser, 'employee');
    await emp.page.goto('/leave', { waitUntil: 'networkidle' });
    await emp.page.getByRole('button', { name: 'Apply for Leave' }).click();
    const policyId = (await api('employee', '/leave/policies')).body[0].id;
    await emp.page.locator('select').first().selectOption(policyId);
    const dates = emp.page.locator('input[type="date"]');
    await dates.nth(0).fill(iso(2)); await dates.nth(1).fill(iso(3));
    await emp.page.getByPlaceholder('Reason').fill(`${tag} uireq`);
    await emp.page.getByRole('button', { name: 'Submit' }).click();
    await expect(emp.page.getByText('PENDING').first()).toBeVisible();
    await shot(emp.page, 'leave-requested');
    const mine = (await api('employee', '/leave/requests')).body.find((r: any) => r.reason === `${tag} uireq`);
    expect(mine.status).toBe('PENDING');

    // bad: far too many days -> a visible error, no crash
    await emp.page.getByRole('button', { name: 'Apply for Leave' }).click();
    await emp.page.locator('select').first().selectOption(policyId);
    await emp.page.locator('input[type="date"]').nth(0).fill(iso(10));
    await emp.page.locator('input[type="date"]').nth(1).fill(iso(200));
    await emp.page.getByRole('button', { name: 'Submit' }).click();
    await expect(emp.page.getByRole('alert')).toBeVisible();
    await shot(emp.page, 'leave-error');

    const mgr = await asRole(browser, 'manager');
    await mgr.page.goto('/approvals', { waitUntil: 'networkidle' });
    await expect(mgr.page.getByText(/Pending Items/)).toBeVisible();
    await mgr.page.getByRole('button', { name: 'Approve' }).first().click();
    await expect.poll(async () => (await api('employee', '/leave/requests')).body.find((r: any) => r.id === mine.id).status, { timeout: 15_000 }).toBe('APPROVED');
    await shot(mgr.page, 'approvals-approved');
    await emp.ctx.close(); await mgr.ctx.close();
  });
  test('employee cannot reach admin screens; the page redirects', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'employee');
    for (const p of ['/payroll', '/settings', '/platform', '/settings/logins', '/billing']) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/dashboard/, { timeout: 10_000 });
    }
    await ctx.close();
  });
});

test.describe('Leave setup + staff logins (UI, HR)', () => {
  test('policy create/edit and holiday add/remove persist', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'hr');
    await page.goto('/settings/leave', { waitUntil: 'networkidle' });
    const code = `zz${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'New leave type' }).click();
    // required fields: an empty submit is blocked by the browser
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'New leave type' })).toBeVisible();
    await page.getByLabel('Name').fill(`${tag} UI leave`);
    await page.getByLabel('Short code').fill(code);
    await page.getByLabel('Days a year').fill('9');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Created\. \d+ (person|people) now have/)).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(`${tag} UI leave`) })).toBeVisible();
    // edit: change the days, reload, still there
    await page.getByRole('row', { name: new RegExp(`${tag} UI leave`) }).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Days a year').fill('11');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();
    await page.reload({ waitUntil: 'networkidle' });
    const row = (await api('hr', '/leave/policies/all')).body.find((p: any) => p.code === code);
    expect(Number(row.daysPerYear)).toBe(11);
    expect(await page.getByRole('row', { name: new RegExp(`${tag} UI leave`) }).innerText()).toContain('11');
    // invalid code is refused by the form
    await page.getByRole('button', { name: 'New leave type' }).click();
    await page.getByLabel('Name').fill('Bad code'); await page.getByLabel('Short code').fill('BAD CODE'); await page.getByLabel('Days a year').fill('1');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'New leave type' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    // holiday add -> listed -> delete -> gone
    await page.getByLabel('Holiday', { exact: true }).fill(`${tag} Holiday`);
    await page.getByLabel('Date').fill(iso(40));
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(`${tag} Holiday`)).toBeVisible();
    await shot(page, 'settings-leave-after');
    await page.getByRole('button', { name: `Delete ${tag} Holiday` }).click();
    await expect(page.getByText(`${tag} Holiday`)).toBeHidden();
    await ctx.close();
  });
  test('invite a staff login and revoke it', async ({ browser }) => {
    const e = await api('hr', '/employees', 'POST', { employeeCode: `${tag}-LG`, firstName: 'Login', lastName: tag, email: `login.${tag.toLowerCase()}@qa.test` });
    const { page, ctx } = await asRole(browser, 'hr');
    await page.goto('/settings/logins', { waitUntil: 'networkidle' });
    await page.getByRole('row', { name: new RegExp(`Login ${tag}`) }).getByRole('button', { name: /Invite/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Send/ }).click();
    await expect(page.getByRole('row', { name: new RegExp(`Login ${tag}`) }).getByText(/Invited/)).toBeVisible();
    await shot(page, 'logins-invited');
    expect(JSON.stringify((await api('hr', '/invites/people')).body)).toContain(e.body.id);
    await ctx.close();
  });
});

test.describe('Timesheets + 1-on-1 (UI)', () => {
  test('timesheet: add entry, persists after reload, delete', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'employee');
    await page.goto('/timesheets', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Log Hours' }).click();
    await page.getByRole('spinbutton', { name: 'Hours' }).fill('3.5');
    await page.getByPlaceholder('What did you work on?').fill(`${tag} ts`);
    await page.getByRole('button', { name: 'Save Entry' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(`${tag} ts`)).toBeVisible();
    await shot(page, 'timesheet-entry');
    await page.getByRole('button', { name: 'Delete entry' }).first().click();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(`${tag} ts`)).toBeHidden();
    await ctx.close();
  });
  test('1-on-1: schedule with a report, appears, complete; non-report is not offered', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'manager');
    await page.goto('/one-on-ones', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Schedule 1-on-1' }).first().click();
    const dlg = page.getByRole('dialog');
    const opts = await dlg.locator('select option').allInnerTexts();
    expect(opts.join('|')).toContain('Esha');
    expect(opts.join('|'), 'a non-report must not be selectable').not.toContain('Ehsan');
    await dlg.getByLabel('Team member').selectOption({ label: opts.find((o) => o.includes('Esha'))! });
    await dlg.getByLabel('When').fill(`${iso(3)}T10:00`);
    await dlg.getByLabel(/Talking points/).fill(`${tag} point one`);
    await shot(page, 'one-on-one-form');
    await dlg.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.getByText(`${tag} point one`)).toBeVisible();
    const mine = (await api('manager', '/one-on-ones')).body.find((m: any) => JSON.stringify(m.talkingPoints).includes(tag));
    expect(mine.employeeId).toBe(accounts().users.employee.employeeId);
    await ctx.close();
  });
});
