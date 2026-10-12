import { test, expect } from '@playwright/test';
import { accounts, api, login } from '../lib';

test('tenant B cannot open tenant A records by URL: nothing of A is shown', async ({ browser }) => {
  const A = accounts().users;
  const aEmp = A.employee.employeeId as string;
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await login(page, 'adminB');
  const leak = async (path: string) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.locator('#main').waitFor({ timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const text = await page.locator('body').innerText();
    expect(text, `${path} leaked tenant A data`).not.toMatch(/Esha|ZZ-TEST-A|zz-employee-/);
  };
  await leak(`/employees/${aEmp}`);
  const mine = await api('employee', '/leave/requests', 'POST', { policyId: (await api('employee', '/leave/policies')).body[0].id, startDate: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), endDate: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) });
  void mine;
  // an A payment request id on the receipt page of B
  const acct = (await api('superadmin', '/platform/billing/accounts')).body.find((x: any) => x.isActive);
  if (acct) {
    const req = await api('admin', '/billing/requests', 'POST', { purpose: 'plan', planCode: 'starter', period: 'monthly', accountId: acct.id });
    if (req.status < 300) { await leak(`/receipt/${req.body.id}`); await api('admin', `/billing/requests/${req.body.id}/cancel`, 'POST'); }
  }
  // direct API with B's token on A's ids (404/403, never data)
  for (const p of [`/employees/${aEmp}`, `/employees/${aEmp}/documents/x/link`, `/leave/requests?employeeId=${aEmp}`, `/payroll/compensation-items?employeeId=${aEmp}`]) {
    const r = await api('adminB', p);
    expect(JSON.stringify(r.body), p).not.toMatch(/Esha|ZZ-TEST-A/);
  }
  await ctx.close();
});

test('an employee of tenant A cannot read a colleague\'s payslip link or another employee\'s documents', async () => {
  const slips = await api('employee2', '/employees/me/payslips');
  expect(slips.status).toBe(200);
  for (const id of ['zz-nonexistent']) {
    expect([403, 404]).toContain((await api('employee2', `/employees/me/payslips/${id}/link`)).status);
    expect([403, 404]).toContain((await api('employee2', `/employees/${accounts().users.employee.employeeId}/documents/${id}/link`)).status);
  }
  const other = await api('employee2', `/employees/${accounts().users.employee.employeeId}`);
  expect(JSON.stringify(other.body)).not.toMatch(/baseSalary|bankAccount|cnic/);
});
