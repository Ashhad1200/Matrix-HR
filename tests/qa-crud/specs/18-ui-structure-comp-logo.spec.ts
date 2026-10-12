import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'path';
import { accounts, api, watch, login, type Who } from '../lib';

const cellRow = (page: Page, table: string, name: string) => page.getByTestId(table).locator('tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${name}$`) }) });
const SHOTS = resolve(__dirname, '../../../docs/qa/screenshots');
const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const shot = (p: Page, n: string) => p.screenshot({ path: resolve(SHOTS, `${n}.png`) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function asRole(browser: any, who: Who) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page: Page = await ctx.newPage();
  const problems = watch(page, [/Failed to fetch RSC payload/]);
  page.on('dialog', (d) => d.accept());
  await login(page, who);
  return { page, ctx, problems };
}

test.describe('Departments and designations (UI)', () => {
  test('HR creates, nests, renames, imports and deletes; delete is refused while in use', async ({ browser }) => {
    const { page, ctx, problems } = await asRole(browser, 'hr');
    await page.goto('/settings/structure', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Departments & designations' })).toBeVisible();

    await page.getByRole('button', { name: 'New department' }).click();
    await page.locator('#s-name').fill(`${tag} Ops`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const dept = cellRow(page, 'departments-table', `${tag} Ops`);
    await expect(dept).toBeVisible();
    // same name again: the server's refusal is shown in the form
    await page.getByRole('button', { name: 'New department' }).click();
    await page.locator('#s-name').fill(`${tag} ops`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /already/i })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // child department, then rename the parent
    await page.getByRole('button', { name: 'New department' }).click();
    await page.locator('#s-name').fill(`${tag} Ops East`);
    await page.locator('#s-parent').selectOption({ label: `${tag} Ops` });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(cellRow(page, 'departments-table', `${tag} Ops East`)).toBeVisible();
    await dept.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#s-name').fill(`${tag} Operations`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const renamed = cellRow(page, 'departments-table', `${tag} Operations`);
    await expect(renamed).toBeVisible();

    // refused while it has a sub-department
    await renamed.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /sub-department|cannot|in use/i })).toBeVisible();
    await shot(page, 'structure-delete-refused');
    await expect(cellRow(page, 'departments-table', `${tag} Operations`)).toBeVisible();

    // designation
    await page.getByRole('button', { name: 'New designation' }).click();
    await page.locator('#s-name').fill(`${tag} Analyst`);
    await page.locator('#s-grade').fill('G2');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const des = page.getByTestId('designations-table').locator('tr', { hasText: `${tag} Analyst` });
    await expect(des).toBeVisible();

    // import
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.locator('#s-csv').fill(`${tag} Imp A\n${tag} Imp B, ${tag} Imp A`);
    await page.getByRole('button', { name: 'Import', exact: true }).last().click();
    await expect(page.getByRole('status').filter({ hasText: /Imported 2 new/ })).toBeVisible();
    await shot(page, 'structure-imported');

    // clean up through the UI: children first
    for (const name of [`${tag} Imp B`, `${tag} Imp A`, `${tag} Ops East`, `${tag} Operations`]) {
      await cellRow(page, 'departments-table', name).getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('status').filter({ hasText: `${name} deleted` })).toBeVisible();
    }
    await des.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${tag} Analyst deleted` })).toBeVisible();

    // an employee cannot open it
    expect(problems.filter((p) => !/40[39]|Failed to load resource/.test(p))).toEqual([]);
    await ctx.close();
    const emp = await asRole(browser, 'employee');
    await emp.page.goto('/settings/structure', { waitUntil: 'networkidle' });
    expect(new URL(emp.page.url()).pathname).toBe('/dashboard');
    await emp.ctx.close();
  });
});

test.describe('Pay components (UI)', () => {
  test('HR adds a recurring allowance and a one-off bonus, edits and removes them', async ({ browser }) => {
    const { page, ctx, problems } = await asRole(browser, 'hr');
    await page.goto('/settings/compensation', { waitUntil: 'networkidle' });
    const empId = accounts().users.employee.employeeId;
    await page.locator('#c-emp').selectOption(empId);
    await page.getByRole('button', { name: 'Add component' }).click();
    await page.locator('#k-type').selectOption('ALLOWANCE');
    await page.locator('#k-label').fill(`${tag} Fuel`);
    await page.locator('#k-amount').fill('5000');
    await page.locator('#k-start').fill('2031-01');
    await page.locator('#k-end').fill('2031-06');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const row = page.getByTestId('comp-table').locator('tr', { hasText: `${tag} Fuel` });
    await expect(row).toBeVisible();
    await expect(row).toContainText('2031-01');
    await expect(row).toContainText('2031-06');
    await shot(page, 'pay-components');

    await page.getByRole('button', { name: 'Add component' }).click();
    await page.locator('#k-type').selectOption('BONUS');
    await page.locator('#k-label').fill(`${tag} Eid`);
    await page.locator('#k-amount').fill('20000');
    await page.getByLabel('Repeats every month').uncheck();
    await page.locator('#k-start').fill('2031-03');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('comp-table').locator('tr', { hasText: `${tag} Eid` })).toContainText('Once, 2031-03');

    // end before start is refused with the server's message
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#k-end').fill('2030-12');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /before the start/i })).toBeVisible();
    await page.locator('#k-end').fill('2031-09');
    await page.locator('#k-amount').fill('6500');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('comp-table').locator('tr', { hasText: `${tag} Fuel` })).toContainText('6,500');

    for (const n of [`${tag} Fuel`, `${tag} Eid`]) {
      await page.getByTestId('comp-table').locator('tr', { hasText: n }).getByRole('button', { name: 'Remove' }).click();
      await expect(page.getByTestId('comp-table').locator('tr', { hasText: n })).toHaveCount(0);
    }
    const log = (await api('hr', '/audit/logs?entity=CompensationItem&limit=100')).body;
    expect(log.some((l: any) => l.action === 'DELETE')).toBe(true);
    expect(problems.filter((p) => !/40[39]|Failed to load resource/.test(p))).toEqual([]);
    await ctx.close();
    // managers and employees do not get the screen
    const mgr = await asRole(browser, 'manager');
    await mgr.page.goto('/settings/compensation', { waitUntil: 'networkidle' });
    expect(new URL(mgr.page.url()).pathname).toBe('/dashboard');
    await mgr.ctx.close();
  });
});

test.describe('Client logo (backoffice UI)', () => {
  test('the operator uploads a logo for a client company, sees it in that company, and removes it', async ({ browser }) => {
    const op = await asRole(browser, 'superadmin');
    const tenantId = (await api('admin', '/auth/me')).body.tenantId;
    await op.page.goto(`/platform/${tenantId}`, { waitUntil: 'networkidle' });
    await expect(op.page.getByText('Branding')).toBeVisible();
    // a non-image is refused with a clear message
    await op.page.getByTestId('logo-input').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all, honestly') });
    await expect(op.page.getByRole('alert').filter({ hasText: /PNG, JPEG or WebP/ })).toBeVisible();
    await op.page.getByTestId('logo-input').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await expect(op.page.getByRole('status').filter({ hasText: /Logo saved/ })).toBeVisible();
    await expect(op.page.locator('img[alt$="logo"]')).toBeVisible();
    await shot(op.page, 'platform-client-logo');

    const client = await asRole(browser, 'admin');
    await expect(client.page.locator('header img[src^="data:image/png"]').first()).toBeVisible();
    await client.ctx.close();

    await op.page.getByRole('button', { name: 'Remove logo' }).click();
    await expect(op.page.getByRole('status').filter({ hasText: /Logo removed/ })).toBeVisible();
    expect((await api('admin', '/auth/me')).body.tenant.logoUrl ?? null).toBeNull();
    await op.ctx.close();
  });
});
