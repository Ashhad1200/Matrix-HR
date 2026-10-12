import { test, expect } from '@playwright/test';
import { accounts, api } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const today = new Date().toISOString().slice(0, 10);
let catId = ''; let claimId = '';

test.describe('Expenses', () => {
  test('category CRUD (HR) and permissions', async () => {
    const c = await api('hr', '/expenses/categories', 'POST', { name: `${tag} Travel`, maxAmountPerItem: 500, requiresReceipt: false });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    catId = c.body.id;
    expect((await api('employee', '/expenses/categories')).body.map((x: any) => x.id)).toContain(catId);
    expect((await api('hr', `/expenses/categories/${catId}`, 'PATCH', { name: `${tag} Travel 2`, maxAmountPerItem: 800 })).status).toBe(200);
    const row = (await api('employee', '/expenses/categories')).body.find((x: any) => x.id === catId);
    expect(row.name).toBe(`${tag} Travel 2`);
    expect(Number(row.maxAmountPerItem)).toBe(800);
    expect((await api('employee', '/expenses/categories', 'POST', { name: 'nope' })).status).toBe(403);
    expect((await api('hr', '/expenses/categories', 'POST', { name: '' })).status, 'empty category name').toBe(400);
    expect((await api('hr', '/expenses/categories', 'POST', { name: 'x', maxAmountPerItem: -5 })).status).toBe(400);
  });
  test('claim: create draft, validation, update, delete', async () => {
    const item = { categoryId: catId, date: today, amount: 120.5, description: `${tag} taxi` };
    const c = await api('employee', '/expenses/claims', 'POST', { title: `${tag} claim`, items: [item] });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    claimId = c.body.id;
    expect((await api('employee', '/expenses/claims', 'POST', { title: 'x', items: [] })).status).toBe(400);
    expect((await api('employee', '/expenses/claims', 'POST', { title: 'x', items: [{ ...item, amount: -3 }] })).status).toBe(400);
    expect((await api('employee', '/expenses/claims', 'POST', { title: 'x', items: [{ ...item, amount: 99999 }] })).status, 'above the category cap').toBeGreaterThanOrEqual(400);
    expect((await api('employee', '/expenses/claims', 'POST', { title: 'x', items: [{ ...item, categoryId: 'nope' }] })).status).toBeLessThan(500);
    const g = await api('employee', `/expenses/claims/${claimId}`);
    expect(g.body.title).toBe(`${tag} claim`);
    expect(Number(g.body.total ?? g.body.totalAmount ?? g.body.items.reduce((s: number, i: any) => s + Number(i.amount), 0))).toBeCloseTo(120.5, 2);
    expect((await api('employee', `/expenses/claims/${claimId}`, 'PATCH', { title: `${tag} claim 2`, items: [{ ...item, amount: 200 }] })).status).toBe(200);
    expect(Number((await api('employee', `/expenses/claims/${claimId}`)).body.items[0].amount)).toBe(200);
    const tmp = await api('employee', '/expenses/claims', 'POST', { title: `${tag} tmp`, items: [item] });
    expect((await api('employee', `/expenses/claims/${tmp.body.id}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('employee', `/expenses/claims/${tmp.body.id}`)).status).toBe(404);
  });
  test('visibility: other employees and other tenants cannot see it', async () => {
    expect([403, 404]).toContain((await api('employee2', `/expenses/claims/${claimId}`)).status);
    expect([403, 404]).toContain((await api('adminB', `/expenses/claims/${claimId}`)).status);
    expect((await api('employee2', '/expenses/claims')).body.map?.((x: any) => x.id) ?? []).not.toContain(claimId);
  });
  test('submit → manager decision; employee cannot self-approve; edits locked after submit', async () => {
    expect((await api('employee', `/expenses/claims/${claimId}/submit`, 'POST')).status).toBeLessThan(300);
    expect((await api('employee', `/expenses/claims/${claimId}`, 'PATCH', { title: 'sneaky' })).status, 'edit after submit').toBeGreaterThanOrEqual(400);
    expect((await api('employee', `/expenses/claims/${claimId}`, 'DELETE')).status, 'delete after submit').toBeGreaterThanOrEqual(400);
    expect((await api('employee', `/expenses/claims/${claimId}/decision`, 'POST', { action: 'APPROVE' })).status).toBe(403);
    expect((await api('employee2', `/expenses/claims/${claimId}/decision`, 'POST', { action: 'APPROVE' })).status).toBe(403);
    expect((await api('manager', '/expenses/inbox')).body.map((x: any) => x.id)).toContain(claimId);
    // approval chain: manager, then HR
    const d = await api('manager', `/expenses/claims/${claimId}/decision`, 'POST', { action: 'APPROVE', comment: 'ok' });
    expect(d.status, JSON.stringify(d.body)).toBeLessThan(300);
    expect((await api('employee', `/expenses/claims/${claimId}`)).body.status, 'still waiting for HR').toBe('SUBMITTED');
    const hr = await api('hr', `/expenses/claims/${claimId}/decision`, 'POST', { action: 'APPROVE' });
    expect(hr.status, JSON.stringify(hr.body)).toBeLessThan(300);
    const again = await api('manager', `/expenses/claims/${claimId}/decision`, 'POST', { action: 'REJECT' });
    expect(again.status, 'a decided claim cannot be flipped').toBeGreaterThanOrEqual(400);
    expect((await api('employee', `/expenses/claims/${claimId}`)).body.status).toMatch(/APPROVED/);
  });
  test('a manager cannot decide a claim from a non-report', async () => {
    const item = { categoryId: catId, date: today, amount: 10, description: 'x' };
    const c = await api('employee2', '/expenses/claims', 'POST', { title: `${tag} other`, items: [item] });
    await api('employee2', `/expenses/claims/${c.body.id}/submit`, 'POST');
    const d = await api('manager', `/expenses/claims/${c.body.id}/decision`, 'POST', { action: 'APPROVE' });
    expect([403, 404], 'manager decided a non-report claim: ' + d.status).toContain(d.status);
  });
  test('cancel works on a submitted claim', async () => {
    const c = await api('employee', '/expenses/claims', 'POST', { title: `${tag} cancel`, items: [{ categoryId: catId, date: today, amount: 5, description: 'c' }] });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    await api('employee', `/expenses/claims/${c.body.id}/submit`, 'POST');
    expect((await api('employee', `/expenses/claims/${c.body.id}/cancel`, 'POST')).status).toBeLessThan(300);
    expect((await api('employee', `/expenses/claims/${c.body.id}`)).body.status).toMatch(/CANCEL/);
  });
});

test.describe('Loans and advances', () => {
  let loanId = '';
  test('create / validate / read / permissions', async () => {
    const period = `${new Date().getFullYear()}-12`;
    const l = await api('employee', '/loans', 'POST', { type: 'ADVANCE', amount: 5000, installments: 5, firstDeductionPeriod: period, reason: tag });
    expect(l.status, JSON.stringify(l.body)).toBe(201);
    loanId = l.body.id;
    expect((await api('employee', '/loans', 'POST', { type: 'ADVANCE', amount: -1, firstDeductionPeriod: period })).status).toBe(400);
    expect((await api('employee', '/loans', 'POST', { type: 'LOAN', amount: 100, firstDeductionPeriod: 'soon' })).status).toBe(400);
    expect((await api('employee', `/loans/${loanId}`)).status).toBe(200);
    expect([403, 404]).toContain((await api('employee2', `/loans/${loanId}`)).status);
    expect([403, 404]).toContain((await api('adminB', `/loans/${loanId}`)).status);
    expect((await api('manager', `/loans/${loanId}/decision`, 'POST', { action: 'APPROVE' })).status, 'manager is not a loan approver').toBe(403);
  });
  test('HR decision is final; cancel only own pending', async () => {
    // chain: HR, then company admin
    const d = await api('hr', `/loans/${loanId}/decision`, 'POST', { action: 'APPROVE', comment: 'ok' });
    expect(d.status, JSON.stringify(d.body)).toBeLessThan(300);
    expect((await api('hr', `/loans/${loanId}/decision`, 'POST', { action: 'APPROVE' })).status, 'same step cannot be approved twice').toBeGreaterThanOrEqual(400);
    const d2 = await api('admin', `/loans/${loanId}/decision`, 'POST', { action: 'APPROVE' });
    expect(d2.status, JSON.stringify(d2.body)).toBeLessThan(300);
    expect((await api('employee', `/loans/${loanId}`)).body.status).toBe('APPROVED');
    expect((await api('hr', `/loans/${loanId}/decision`, 'POST', { action: 'REJECT' })).status, 'a decided loan cannot be flipped').toBeGreaterThanOrEqual(400);
    expect((await api('employee', `/loans/${loanId}/cancel`, 'POST')).status, 'cannot cancel an approved loan').toBeGreaterThanOrEqual(400);
    const l2 = await api('employee', '/loans', 'POST', { type: 'LOAN', amount: 900, installments: 3, firstDeductionPeriod: `${new Date().getFullYear()}-12` });
    expect((await api('employee2', `/loans/${l2.body.id}/cancel`, 'POST')).status).toBeGreaterThanOrEqual(400);
    expect((await api('employee', `/loans/${l2.body.id}/cancel`, 'POST')).status).toBeLessThan(300);
  });
});

test.describe('Compensation items and payroll run', () => {
  let itemId = ''; let runId = '';
  test('compensation item CRUD (HR) with validation', async () => {
    const empId = accounts().users.employee.employeeId;
    const r = await api('hr', '/payroll/compensation-items', 'POST', { employeeId: empId, type: 'ALLOWANCE', label: `${tag} allowance`, amount: 1500 });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    itemId = r.body.id;
    expect((await api('hr', '/payroll/compensation-items')).body.map((x: any) => x.id)).toContain(itemId);
    expect((await api('hr', '/payroll/compensation-items', 'POST', { employeeId: empId, type: 'NOPE', label: 'x', amount: 1 })).status).toBe(400);
    expect((await api('hr', '/payroll/compensation-items', 'POST', { employeeId: accounts().users.employeeB.employeeId, type: 'BONUS', label: 'x', amount: 1 })).status, 'employee from another tenant').toBeGreaterThanOrEqual(400);
    expect((await api('employee', '/payroll/compensation-items')).status).toBe(403);
    expect((await api('manager', '/payroll/compensation-items', 'POST', { employeeId: empId, type: 'BONUS', label: 'x', amount: 1 })).status).toBe(403);
    expect((await api('hr', `/payroll/compensation-items/${itemId}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('hr', '/payroll/compensation-items')).body.map((x: any) => x.id)).not.toContain(itemId);
  });
  test('payroll run: create → recalc → submit → approve → lock, with role gates', async () => {
    const a = accounts();
    const r = await api('hr', '/payroll/runs', 'POST', { period: '2026-09' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    runId = r.body.run.id;
    expect((await api('hr', '/payroll/runs', 'POST', { period: '2026-09' })).status, 'duplicate period must not create a second run or 500').toBeLessThan(500);
    expect((await api('employee', '/payroll/runs')).status).toBe(403);
    expect((await api('manager', `/payroll/runs/${runId}`)).status).toBe(403);
    expect((await api('adminB', `/payroll/runs/${runId}`)).status).toBe(404);
    expect((await api('hr', `/payroll/runs/${runId}/recalculate`, 'POST')).status).toBeLessThan(300);
    expect((await api('hr', `/payroll/runs/${runId}/approve`, 'POST')).status, 'cannot approve before submit').toBeGreaterThanOrEqual(400);
    expect((await api('hr', `/payroll/runs/${runId}/submit`, 'POST')).status).toBeLessThan(300);
    const self = await api('hr', `/payroll/runs/${runId}/approve`, 'POST');
    // maker-checker: the preparer should not approve their own run
    expect.soft(self.status, 'preparer approved own run (maker-checker)').toBeGreaterThanOrEqual(400);
    const ok = await api('admin', `/payroll/runs/${runId}/approve`, 'POST');
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect((await api('hr', `/payroll/runs/${runId}/lock`, 'POST')).status).toBeLessThan(300);
    expect((await api('hr', `/payroll/runs/${runId}/recalculate`, 'POST')).status, 'a locked run cannot be recalculated').toBeGreaterThanOrEqual(400);
    expect((await api('hr', `/payroll/runs/${runId}/reopen`, 'POST', { reason: 'ZZ test reopen reason' })).status, 'only a company admin may reopen').toBe(403);
    expect((await api('admin', `/payroll/runs/${runId}/reopen`, 'POST', { reason: 'ZZ test reopen reason' })).status).toBeLessThan(300);
    void a;
  });
  test('reports: payroll-cost is HR/admin only; headcount allowed for manager', async () => {
    expect((await api('manager', '/reports/payroll-cost')).status).toBe(403);
    expect((await api('employee', '/reports/headcount')).status).toBe(403);
    expect((await api('manager', '/reports/headcount')).status).toBe(200);
    expect((await api('hr', '/reports/payroll-cost')).status).toBe(200);
  });
});
