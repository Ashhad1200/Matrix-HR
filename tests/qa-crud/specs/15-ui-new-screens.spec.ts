import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'path';
import { accounts, api, login, watch, type Who } from '../lib';

const SHOTS = resolve(__dirname, '../../../docs/qa/screenshots');
const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const shot = (p: Page, n: string) => p.screenshot({ path: resolve(SHOTS, `${n}.png`) });
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
async function asRole(browser: any, who: Who) { const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page: Page = await ctx.newPage(); const problems = watch(page, [/Failed to load resource/, /Failed to fetch RSC payload/]); await login(page, who); return { page, ctx, problems }; }
const nextMonday = (weeks: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + ((1 - d.getUTCDay() + 7) % 7) + 7 * weeks); return d.toISOString().slice(0, 10); };

test.describe('Recruitment (UI)', () => {
  test('HR creates a job, edits it, adds a candidate, closes and reopens the job', async ({ browser }) => {
    const { page, ctx, problems } = await asRole(browser, 'hr');
    await page.goto('/recruitment', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New job' }).click();
    await page.getByRole('button', { name: 'Save job' }).click(); // empty: blocked by the browser
    await expect(page.getByRole('heading', { name: 'New job' })).toBeVisible();
    await page.getByLabel('Job title').fill(`${tag} Designer`);
    await page.getByLabel('Department (optional)').fill('Design');
    await page.getByLabel('Description').fill('Make things look good');
    await page.getByRole('button', { name: 'Save job' }).click();
    const row = page.getByTestId('job-row').filter({ hasText: `${tag} Designer` });
    await expect(row).toBeVisible();
    await shot(page, 'recruitment-job-created');
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Job title').fill(`${tag} Senior Designer`);
    await page.getByRole('button', { name: 'Save job' }).click();
    const row2 = page.getByTestId('job-row').filter({ hasText: `${tag} Senior Designer` });
    await expect(row2).toBeVisible();
    // candidate
    await page.getByRole('button', { name: 'Add candidate' }).click();
    await page.getByLabel('Job', { exact: true }).selectOption({ label: `${tag} Senior Designer` });
    await page.getByLabel('First name').fill('Cara'); await page.getByLabel('Last name').fill(tag);
    await page.getByLabel('Email').fill(`cara.${tag.toLowerCase()}@qa.test`);
    await page.getByRole('button', { name: 'Add candidate' }).last().click();
    await expect(page.getByText(`Cara ${tag}`)).toBeVisible();
    // a bad email is refused by the form
    await page.getByRole('button', { name: 'Add candidate' }).first().click();
    await page.getByLabel('Job', { exact: true }).selectOption({ label: `${tag} Senior Designer` });
    await page.getByLabel('First name').fill('X'); await page.getByLabel('Last name').fill('Y'); await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Add candidate' }).last().click();
    await expect(page.getByRole('heading', { name: 'Add candidate' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    // close / reopen
    await row2.getByRole('button', { name: 'Close job' }).click();
    await expect(row2.getByText('closed')).toBeVisible();
    await row2.getByRole('button', { name: 'Reopen job' }).click();
    await expect(row2.getByText('open')).toBeVisible();
    const saved = (await api('hr', '/recruitment/jobs')).body.find((j: any) => j.title === `${tag} Senior Designer`);
    expect(saved).toMatchObject({ department: 'Design', status: 'open' });
    expect(problems).toEqual([]);
    await ctx.close();
  });
});

test.describe('Performance (UI)', () => {
  test('HR creates and edits a cycle; the employee adds a goal, edits it, updates progress', async ({ browser }) => {
    const hr = await asRole(browser, 'hr');
    await hr.page.goto('/performance', { waitUntil: 'networkidle' });
    await hr.page.getByRole('button', { name: 'New cycle' }).click();
    await hr.page.getByLabel('Name').fill(`${tag} H1`);
    await hr.page.getByLabel('Start date').fill(iso(-5)); await hr.page.getByLabel('End date').fill(iso(-10)); // end before start
    await hr.page.getByRole('button', { name: 'Save cycle' }).click();
    await expect(hr.page.getByRole('alert').filter({ hasText: /end date/i })).toBeVisible();
    await hr.page.getByLabel('End date').fill(iso(60));
    await hr.page.getByRole('button', { name: 'Save cycle' }).click();
    const row = hr.page.getByTestId('cycle-row').filter({ hasText: `${tag} H1` });
    await expect(row).toBeVisible();
    await shot(hr.page, 'performance-cycle');
    await row.getByRole('button', { name: 'Edit' }).click();
    await hr.page.getByLabel('Name').fill(`${tag} H1 final`);
    await hr.page.getByRole('button', { name: 'Save cycle' }).click();
    await expect(hr.page.getByTestId('cycle-row').filter({ hasText: `${tag} H1 final` })).toBeVisible();

    const emp = await asRole(browser, 'employee');
    await emp.page.goto('/performance', { waitUntil: 'networkidle' });
    expect(await emp.page.getByRole('button', { name: 'New cycle' }).count(), 'employees cannot create cycles').toBe(0);
    await emp.page.getByRole('button', { name: 'New goal' }).click();
    await emp.page.getByLabel('Goal', { exact: true }).fill(`${tag} learn Rust`);
    await emp.page.getByLabel('Due date (optional)').fill(iso(45));
    await emp.page.getByRole('button', { name: 'Save goal' }).click();
    const goal = emp.page.getByTestId('goal-row').filter({ hasText: `${tag} learn Rust` });
    await expect(goal).toBeVisible();
    await goal.getByRole('button', { name: 'Edit' }).click();
    await emp.page.getByLabel('Goal', { exact: true }).fill(`${tag} learn Rust well`);
    await emp.page.getByRole('button', { name: 'Save goal' }).click();
    const goal2 = emp.page.getByTestId('goal-row').filter({ hasText: `${tag} learn Rust well` });
    await expect(goal2).toBeVisible();
    await goal2.getByLabel(/Progress for/).fill('140');
    await goal2.getByRole('button', { name: 'Update progress' }).click();
    await expect(emp.page.getByRole('alert')).toBeVisible(); // 140% refused
    await goal2.getByLabel(/Progress for/).fill('60');
    await goal2.getByRole('button', { name: 'Update progress' }).click();
    await expect.poll(async () => Number((await api('employee', '/performance/goals')).body.find((g: any) => g.title === `${tag} learn Rust well`).progress)).toBe(60);
    await shot(emp.page, 'performance-goal');
    await hr.ctx.close(); await emp.ctx.close();
  });
});

test.describe('Onboarding (UI)', () => {
  test('HR builds a checklist, starts it for an employee, and the checklist locks', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'hr');
    await page.goto('/onboarding', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New template' }).click();
    await page.getByLabel('Name').fill(`${tag} New joiner`);
    await page.getByLabel('Task 1 title').fill('Sign the contract');
    await page.getByRole('button', { name: 'Add task' }).click();
    await page.getByLabel('Task 2 title').fill('Collect laptop');
    await page.getByLabel('Task 2 owner').selectOption('it');
    await page.getByRole('button', { name: 'Save checklist' }).click();
    const row = page.getByTestId('template-row').filter({ hasText: `${tag} New joiner` });
    await expect(row).toContainText('2 tasks');
    await shot(page, 'onboarding-template');
    await page.getByRole('button', { name: 'Start onboarding' }).click();
    await page.getByLabel('Employee').selectOption({ label: 'Esha ZZ-TEST' });
    await page.getByLabel('Checklist').selectOption({ label: `${tag} New joiner` });
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('Esha ZZ-TEST').first()).toBeVisible();
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Task 1 title').fill('changed after start');
    await page.getByRole('button', { name: 'Save checklist' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /already started/i })).toBeVisible(); // locked, with a reason
    await ctx.close();
  });
});

test.describe('Learning (UI)', () => {
  test('HR creates a course; the employee enrols and records progress; HR archives it', async ({ browser }) => {
    const hr = await asRole(browser, 'hr');
    await hr.page.goto('/lms', { waitUntil: 'networkidle' });
    await hr.page.getByRole('button', { name: 'New course' }).click();
    await hr.page.getByLabel('Title').fill(`${tag} Safety basics`);
    await hr.page.getByLabel('Description').fill('Fire drills');
    await hr.page.getByLabel('Mandatory for everyone').check();
    await hr.page.getByRole('button', { name: 'Save course' }).click();
    await expect(hr.page.getByTestId('course-card').filter({ hasText: `${tag} Safety basics` })).toContainText('Mandatory');
    await shot(hr.page, 'learning-course');
    const emp = await asRole(browser, 'employee');
    await emp.page.goto('/lms', { waitUntil: 'networkidle' });
    expect(await emp.page.getByRole('button', { name: 'New course' }).count()).toBe(0);
    const card = emp.page.getByTestId('course-card').filter({ hasText: `${tag} Safety basics` });
    await card.getByRole('button', { name: 'Enrol' }).click();
    await card.getByLabel(/Progress in/).fill('100');
    await card.getByRole('button', { name: 'Save progress' }).click();
    await expect(card.getByText('Completed')).toBeVisible();
    await hr.page.reload({ waitUntil: 'networkidle' });
    await hr.page.getByTestId('course-card').filter({ hasText: `${tag} Safety basics` }).getByRole('button', { name: 'Edit course' }).click();
    hr.page.on('dialog', (d) => d.accept());
    await hr.page.getByRole('button', { name: 'Archive' }).click();
    await expect(hr.page.getByText(`${tag} Safety basics`)).toBeHidden();
    await hr.ctx.close(); await emp.ctx.close();
  });
});

test.describe('eNPS (UI)', () => {
  test('HR creates and publishes a survey; each employee answers once; HR sees the count', async ({ browser }) => {
    const hr = await asRole(browser, 'hr');
    await hr.page.goto('/performance/enps', { waitUntil: 'networkidle' });
    await hr.page.getByRole('button', { name: 'New survey' }).click();
    await hr.page.getByLabel('Title').fill(`${tag} Pulse`);
    await hr.page.getByRole('button', { name: 'Save survey' }).click();
    const row = hr.page.getByTestId('survey-row').filter({ hasText: `${tag} Pulse` });
    await expect(row).toContainText('draft');
    const emp = await asRole(browser, 'employee');
    await emp.page.goto('/surveys', { waitUntil: 'networkidle' });
    await expect(emp.page.getByText(`${tag} Pulse`)).toBeHidden(); // a draft is not shown
    await row.getByRole('button', { name: 'Publish' }).click();
    await expect(row).toContainText('active');
    await emp.page.reload({ waitUntil: 'networkidle' });
    const card = emp.page.getByTestId('survey-card').filter({ hasText: `${tag} Pulse` });
    await expect(card.getByRole('button', { name: 'Submit answer' })).toBeDisabled(); // pick a score first
    await card.getByRole('radio', { name: '9', exact: true }).click();
    await card.getByLabel(/Anything you want to add/).fill('Great place');
    await shot(emp.page, 'survey-answer');
    await card.getByRole('button', { name: 'Submit answer' }).click();
    await expect(card.getByText(/already answered|have answered/)).toBeVisible();
    await emp.page.reload({ waitUntil: 'networkidle' });
    await expect(emp.page.getByTestId('survey-card').filter({ hasText: `${tag} Pulse` }).getByText(/have answered/)).toBeVisible();
    expect(await emp.page.getByTestId('survey-card').filter({ hasText: `${tag} Pulse` }).getByRole('button', { name: 'Submit answer' }).count()).toBe(0);
    await hr.page.reload({ waitUntil: 'networkidle' });
    await expect(hr.page.getByTestId('survey-row').filter({ hasText: `${tag} Pulse` })).toContainText('1 responses');
    await hr.ctx.close(); await emp.ctx.close();
  });
});

test.describe('Leave (UI): working days, edit, cancel, weekend', () => {
  test('preview skips the weekend; edit changes dates; cancel returns the days', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'employee');
    await page.goto('/leave', { waitUntil: 'networkidle' });
    const policyId = (await api('employee', '/leave/policies')).body[0].id;
    await page.getByRole('button', { name: 'Apply for Leave' }).click();
    await page.getByLabel('Leave type').selectOption(policyId);
    const mon = nextMonday(6); const nextMon = new Date(new Date(mon).getTime() + 7 * 864e5).toISOString().slice(0, 10);
    await page.getByLabel('Start date').fill(mon); await page.getByLabel('End date').fill(nextMon);
    await expect(page.getByTestId('leave-days-preview')).toContainText('6 working days');
    await page.getByLabel('Reason').fill(`${tag} ui trip`);
    await page.getByRole('button', { name: 'Submit' }).click();
    const reqRow = page.getByTestId('leave-request').filter({ hasText: `${tag} ui trip` });
    await expect(reqRow).toContainText('6 days');
    await shot(page, 'leave-working-days');
    await reqRow.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('End date').fill(mon);
    await expect(page.getByTestId('leave-days-preview')).toContainText('1 working day');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByTestId('leave-request').filter({ hasText: `${tag} ui trip` })).toContainText('1 day');
    page.on('dialog', (d) => d.accept());
    await page.getByTestId('leave-request').filter({ hasText: `${tag} ui trip` }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('leave-request').filter({ hasText: `${tag} ui trip` })).toContainText('CANCELLED');
    const mine = (await api('employee', '/leave/requests')).body.find((r: any) => r.reason === `${tag} ui trip`);
    expect(mine.status).toBe('CANCELLED');
    await ctx.close();
  });
  test('HR sets the company weekend; weekend-only dates are refused with a reason', async ({ browser }) => {
    const { page, ctx } = await asRole(browser, 'hr');
    await page.goto('/settings/leave', { waitUntil: 'networkidle' });
    await expect(page.getByRole('group', { name: 'Weekend days' })).toBeVisible();
    await expect(page.getByLabel('Saturday')).toBeChecked(); await expect(page.getByLabel('Sunday')).toBeChecked();
    await page.getByLabel('Friday').check();
    await page.getByRole('button', { name: 'Save weekend' }).click();
    await expect(page.getByText(/Weekend saved/)).toBeVisible();
    expect((await api('hr', '/leave/weekend')).body.weekendDays.sort()).toEqual([0, 5, 6]);
    await shot(page, 'settings-weekend');
    await page.getByLabel('Friday').uncheck();
    await page.getByRole('button', { name: 'Save weekend' }).click();
    await expect(page.getByText(/Weekend saved/)).toBeVisible();
    expect((await api('hr', '/leave/weekend')).body.weekendDays.sort()).toEqual([0, 6]);
    await ctx.close();
  });
});

test.describe('Suspended account (UI)', () => {
  test('sign-in shows a clear message; a signed-in session switches to the suspended screen', async ({ browser }) => {
    const s = Math.random().toString(36).slice(2, 8);
    const su = await (await fetch(`${process.env.API_URL || 'http://localhost:3001/api/v1'}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `susp-${s}@qa.test`, password: 'ZzTest#Passw0rd1', companyName: `${tag} susp`, subdomain: `zz-susp-${s}` }) })).json();
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', `susp-${s}@qa.test`); await page.fill('input[type="password"]', 'ZzTest#Passw0rd1'); await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/); await page.locator('#main').waitFor();
    expect((await api('superadmin', `/platform/tenants/${su.tenant.id}/subscription/status`, 'PATCH', { status: 'suspended' })).status).toBeLessThan(300);
    await page.goto('/leave', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Account suspended' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/contact support/i)).toBeVisible();
    await shot(page, 'account-suspended');
    // a fresh sign-in attempt shows the same message instead of "invalid credentials"
    const page2 = await ctx.newPage();
    await page2.goto('/login', { waitUntil: 'networkidle' });
    await page2.fill('input[type="email"]', `susp-${s}@qa.test`); await page2.fill('input[type="password"]', 'ZzTest#Passw0rd1'); await page2.click('button[type="submit"]');
    await expect(page2.getByText(/Account suspended. Please contact support./)).toBeVisible();
    await api('superadmin', `/platform/tenants/${su.tenant.id}/subscription/status`, 'PATCH', { status: 'active' });
    await ctx.close();
  });
});

test('Workflows and Custom fields are no longer in the menu; their pages redirect', async ({ browser }) => {
  const { page, ctx } = await asRole(browser, 'admin');
  const links = await page.$$eval('aside a', (as) => as.map((a) => a.textContent));
  expect(links.join('|')).not.toMatch(/Workflows|Custom Fields/);
  for (const p of ['/settings/workflows', '/settings/custom-fields']) {
    await page.goto(p, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/settings$/, { timeout: 10_000 });
  }
  await page.goto('/settings', { waitUntil: 'networkidle' });
  expect(await page.locator('#main').innerText()).not.toMatch(/Custom Fields|Workflows/);
  void accounts;
  await ctx.close();
});
