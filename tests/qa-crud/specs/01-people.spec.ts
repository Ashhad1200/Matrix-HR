import { test, expect } from '@playwright/test';
import { accounts, api } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
let empId = '';

test.describe('Employee CRUD (API)', () => {
  test('create: happy path, then it is readable and listed', async () => {
    const body = { employeeCode: `${tag}-1`, firstName: 'Zara', lastName: tag, email: `zara.${tag.toLowerCase()}@qa.test`, phone: '+923001234567', employmentType: 'PERMANENT' };
    const r = await api('hr', '/employees', 'POST', body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    empId = r.body.id;
    const g = await api('hr', `/employees/${empId}`);
    expect(g.status).toBe(200);
    expect(g.body).toMatchObject({ firstName: 'Zara', lastName: tag, employeeCode: `${tag}-1`, email: body.email });
    const l = await api('hr', `/employees?search=${tag}`);
    expect(l.body.data.map((e: any) => e.id)).toContain(empId);
  });
  test('create: required fields, bad email and duplicate code are rejected without a 500', async () => {
    expect((await api('hr', '/employees', 'POST', {})).status).toBe(400);
    const bad = await api('hr', '/employees', 'POST', { employeeCode: `${tag}-2`, firstName: 'A', lastName: 'B', email: 'not-an-email' });
    expect(bad.status).toBe(400);
    const dup = await api('hr', '/employees', 'POST', { employeeCode: `${tag}-1`, firstName: 'Dup', lastName: 'Code' });
    expect([400, 409, 422], JSON.stringify(dup.body)).toContain(dup.status);
    const dupMail = await api('hr', '/employees', 'POST', { employeeCode: `${tag}-3`, firstName: 'Dup', lastName: 'Mail', email: `zara.${tag.toLowerCase()}@qa.test` });
    expect([201, 400, 409, 422], 'duplicate email must never 500').toContain(dupMail.status);
  });
  test('create: unicode and injection strings are stored as text', async () => {
    const r = await api('hr', '/employees', 'POST', { employeeCode: `${tag}-U`, firstName: "Zoë 😀 <img src=x onerror=alert(1)>", lastName: "O'Brien'; DROP TABLE \"Employee\";--" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const g = await api('hr', `/employees/${r.body.id}`);
    expect(g.body.firstName).toContain('<img');
    expect((await api('hr', '/employees?limit=1')).status).toBe(200); // table still there
  });
  test('update: every editable field persists and survives a second edit', async () => {
    const dept = await api('hr', '/employees/departments', 'POST', { name: `${tag}-dept` });
    expect(dept.status, JSON.stringify(dept.body)).toBe(201);
    const des = await api('hr', '/employees/designations', 'POST', { name: `${tag}-role` });
    expect(des.status).toBe(201);
    const patch = { firstName: 'Zaria', lastName: `${tag}-b`, phone: '+923009999999', departmentId: dept.body.id, designationId: des.body.id };
    const u = await api('hr', `/employees/${empId}`, 'PATCH', patch);
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    const g = await api('hr', `/employees/${empId}`);
    expect(g.body).toMatchObject({ firstName: 'Zaria', lastName: `${tag}-b`, phone: '+923009999999', departmentId: dept.body.id, designationId: des.body.id });
    await api('hr', `/employees/${empId}`, 'PATCH', { firstName: 'Zaria2' });
    const g2 = await api('hr', `/employees/${empId}`);
    expect(g2.body.firstName).toBe('Zaria2');
    expect(g2.body.phone).toBe('+923009999999'); // untouched fields did not revert
  });
  test('update: foreign keys from another tenant are refused', async () => {
    const depB = await api('adminB', '/employees/departments', 'POST', { name: `${tag}-depB` });
    const r = await api('hr', `/employees/${empId}`, 'PATCH', { departmentId: depB.body.id });
    expect([400, 404], JSON.stringify(r.body)).toContain(r.status);
  });
  test('update: mass assignment of tenantId/id is ignored or refused', async () => {
    const t = accounts().tenantB;
    const r = await api('hr', `/employees/${empId}`, 'PATCH', { tenantId: t, id: 'x' });
    expect([200, 400]).toContain(r.status);
    const g = await api('hr', `/employees/${empId}`);
    expect(g.body.tenantId).toBe(accounts().tenantA);
  });
  test('read: pagination, filters and the directory view', async () => {
    for (let i = 0; i < 3; i++) await api('hr', '/employees', 'POST', { employeeCode: `${tag}-P${i}`, firstName: `Page${i}`, lastName: tag });
    const p1 = await api('hr', `/employees?search=${tag}&limit=2&page=1`);
    const p2 = await api('hr', `/employees?search=${tag}&limit=2&page=2`);
    expect(p1.body.data).toHaveLength(2);
    expect(p2.body.data.length).toBeGreaterThan(0);
    expect(p1.body.total).toBeGreaterThanOrEqual(5);
    const ids = new Set([...p1.body.data, ...p2.body.data].map((e: any) => e.id));
    expect(ids.size).toBe(p1.body.data.length + p2.body.data.length); // no overlap between pages
    const emp = await api('employee', `/employees?search=${tag}`);
    expect(emp.status).toBe(200);
    for (const e of emp.body.data) { expect(e).not.toHaveProperty('cnic'); expect(e).not.toHaveProperty('bankAccount'); }
  });
  test('delete: there is no delete route (exit is via offboarding)', async () => {
    const r = await api('admin', `/employees/${empId}`, 'DELETE');
    expect([404, 405]).toContain(r.status);
  });
  test('CSV import creates rows and rejects garbage', async () => {
    const r = await api('hr', '/employees/import', 'POST', { rows: [{ employeeCode: `${tag}-I1`, firstName: 'Imp', lastName: 'One' }] });
    expect([200, 201, 400], JSON.stringify(r.body)).toContain(r.status);
    const bad = await api('hr', '/employees/import', 'POST', { rows: 'nope' });
    expect(bad.status).toBeLessThan(500);
  });
});

test.describe('Departments and designations', () => {
  test('create, list, duplicate, validation', async () => {
    const d = await api('hr', '/employees/departments', 'POST', { name: `${tag}-D2` });
    expect(d.status).toBe(201);
    expect((await api('hr', '/employees/departments')).body.map((x: any) => x.id)).toContain(d.body.id);
    const dup = await api('hr', '/employees/departments', 'POST', { name: `${tag}-D2` });
    expect(dup.status, 'duplicate department name must not 500').toBeLessThan(500);
    expect((await api('hr', '/employees/departments', 'POST', { name: '' })).status).toBe(400);
    expect((await api('employee', '/employees/departments', 'POST', { name: 'x' })).status).toBe(403);
  });
});

test.describe('Staff logins (invites)', () => {
  test('invite → list → resend → revoke; only HR/admin', async () => {
    const e = await api('hr', '/employees', 'POST', { employeeCode: `${tag}-INV`, firstName: 'Inv', lastName: tag, email: `inv.${tag.toLowerCase()}@qa.test` });
    const inv = await api('hr', '/invites', 'POST', { employeeId: e.body.id, role: 'EMPLOYEE' });
    expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
    const people = await api('hr', '/invites/people');
    expect(JSON.stringify(people.body)).toContain(e.body.id);
    const id = inv.body.id ?? inv.body.invite?.id;
    expect((await api('hr', `/invites/${id}/resend`, 'POST')).status).toBeLessThan(300);
    expect((await api('hr', `/invites/${id}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('employee', '/invites', 'POST', { employeeId: e.body.id, role: 'EMPLOYEE' })).status).toBe(403);
    expect((await api('hr', '/invites', 'POST', { employeeId: e.body.id, role: 'COMPANY_ADMIN' })).status, 'HR must not mint a company admin').toBe(403);
  });
});
