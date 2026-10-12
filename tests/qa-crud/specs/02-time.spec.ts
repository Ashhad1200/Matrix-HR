import { test, expect } from '@playwright/test';
import { accounts, api } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10);
let policyId = '';

test.describe('Leave policy + holiday CRUD', () => {
  test('policy: create / read / update / deactivate persists; validation', async () => {
    const code = `zz${Date.now().toString(36)}`;
    const c = await api('hr', '/leave/policies', 'POST', { name: `${tag} Leave`, code, daysPerYear: 12, accrualType: 'yearly', carryForwardMax: 3 });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    policyId = c.body.id;
    expect((await api('hr', '/leave/policies/all')).body.map((p: any) => p.id)).toContain(policyId);
    const u = await api('hr', `/leave/policies/${policyId}`, 'PATCH', { name: `${tag} Leave 2`, daysPerYear: 15, carryForwardMax: 5, allowHalfDay: true });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    const row = (await api('hr', '/leave/policies/all')).body.find((p: any) => p.id === policyId);
    expect(row).toMatchObject({ name: `${tag} Leave 2` });
    expect(Number(row.carryForwardMax)).toBe(5); expect(Number(row.daysPerYear)).toBe(15);
    expect((await api('hr', '/leave/policies', 'POST', { name: 'x', code: 'BAD CODE', daysPerYear: -1 })).status).toBe(400);
    expect((await api('hr', '/leave/policies', 'POST', { name: `${tag} dup`, code, daysPerYear: 1 })).status, 'duplicate code').toBeLessThan(500);
    expect((await api('employee', '/leave/policies', 'POST', { name: 'nope', code: 'nope', daysPerYear: 1 })).status).toBe(403);
  });
  test('policy: new policy gives every active employee a balance', async () => {
    const mine = await api('employee', '/leave/balances');
    expect(mine.body.some((b: any) => b.policyId === policyId)).toBe(true);
  });
  test('holiday: create / list / update / delete', async () => {
    const c = await api('hr', '/leave/holidays', 'POST', { name: `${tag} Day`, date: '2027-03-23' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const l = await api('employee', '/leave/holidays?year=2027');
    expect(l.body.map((h: any) => h.id)).toContain(c.body.id);
    expect((await api('hr', `/leave/holidays/${c.body.id}`, 'PATCH', { name: `${tag} Day 2` })).status).toBe(200);
    expect((await api('employee', '/leave/holidays?year=2027')).body.find((h: any) => h.id === c.body.id).name).toBe(`${tag} Day 2`);
    expect((await api('hr', '/leave/holidays', 'POST', { name: 'x' })).status).toBe(400);
    expect((await api('employee', `/leave/holidays/${c.body.id}`, 'DELETE')).status).toBe(403);
    expect((await api('hr', `/leave/holidays/${c.body.id}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('employee', '/leave/holidays?year=2027')).body.map((h: any) => h.id)).not.toContain(c.body.id);
  });
});

test.describe('Leave request lifecycle', () => {
  let reqId = '';
  const bal = async (who: any) => (await api(who, '/leave/balances')).body.find((b: any) => b.policyId === policyId);
  test('employee requests: balance shows pending, validation holds', async () => {
    const before = await bal('employee');
    const r = await api('employee', '/leave/requests', 'POST', { policyId, startDate: day(10), endDate: day(11), reason: tag });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    reqId = r.body.id;
    const after = await bal('employee');
    expect(Number(after.pending) - Number(before.pending)).toBe(2);
    expect((await api('employee', '/leave/requests', 'POST', { policyId, startDate: day(5), endDate: day(1) })).status, 'end before start').toBe(400);
    expect((await api('employee', '/leave/requests', 'POST', { policyId: 'nope', startDate: day(1), endDate: day(2) })).status).toBeLessThan(500);
    const over = await api('employee', '/leave/requests', 'POST', { policyId, startDate: day(20), endDate: day(80) });
    expect(over.status, 'more days than the balance must be refused').toBe(400);
  });
  test('request is visible to employee and manager, hidden from other employee', async () => {
    expect((await api('employee', '/leave/requests')).body.map((x: any) => x.id)).toContain(reqId);
    expect((await api('manager', '/leave/requests')).body.map((x: any) => x.id)).toContain(reqId);
    expect((await api('employee2', '/leave/requests')).body.map((x: any) => x.id)).not.toContain(reqId);
  });
  test('only the right people can decide; approval moves pending → used', async () => {
    expect((await api('employee', `/leave/requests/${reqId}/approve`, 'PATCH')).status).toBe(403);
    expect((await api('employee2', `/leave/requests/${reqId}/approve`, 'PATCH')).status).toBe(403);
    const before = await bal('employee');
    const a = await api('manager', `/leave/requests/${reqId}/approve`, 'PATCH');
    expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
    const after = await bal('employee');
    expect(Number(after.used) - Number(before.used)).toBe(2);
    expect(Number(before.pending) - Number(after.pending)).toBe(2);
    const again = await api('manager', `/leave/requests/${reqId}/approve`, 'PATCH');
    expect(again.status, 'double approve must not double-count').toBeLessThan(500);
    expect(Number((await bal('employee')).used)).toBe(Number(after.used));
  });
  test('reject restores the balance', async () => {
    const r = await api('employee', '/leave/requests', 'POST', { policyId, startDate: day(30), endDate: day(30) });
    const before = await bal('employee');
    expect((await api('hr', `/leave/requests/${r.body.id}/reject`, 'PATCH', { reason: 'ZZ test reject' })).status).toBeLessThan(300);
    const after = await bal('employee');
    expect(Number(before.pending) - Number(after.pending)).toBe(1);
    expect(Number(after.used)).toBe(Number(before.used));
  });
  test('a manager cannot decide a request from someone who is not their report', async () => {
    const r = await api('employee2', '/leave/requests', 'POST', { policyId, startDate: day(40), endDate: day(40) });
    const a = await api('manager', `/leave/requests/${r.body.id}/approve`, 'PATCH');
    expect([403, 404], 'manager approved a non-report: ' + JSON.stringify(a.body)).toContain(a.status);
  });
  test('there is no cancel/delete of a leave request', async () => {
    const r = await api('employee', `/leave/requests/${reqId}`, 'DELETE');
    expect([404, 405]).toContain(r.status);
  });
});

test.describe('Timesheets', () => {
  let projectId = ''; let entryId = '';
  test('project CRUD (HR) and employee entry CRUD', async () => {
    const key = `ZZ${Date.now().toString(36).slice(-5)}`.toUpperCase();
    const p = await api('hr', '/timesheets/projects', 'POST', { key, name: `${tag} Project` });
    expect(p.status, JSON.stringify(p.body)).toBe(201);
    projectId = p.body.id;
    expect((await api('employee', '/timesheets/projects')).body.map((x: any) => x.id)).toContain(projectId);
    expect((await api('hr', `/timesheets/projects/${projectId}`, 'PATCH', { name: `${tag} Project 2` })).status).toBe(200);
    expect((await api('employee', '/timesheets/projects', 'POST', { key: 'EMP', name: 'x' })).status).toBe(403);
    expect((await api('hr', '/timesheets/projects', 'POST', {})).status).toBe(400);

    const e = await api('employee', '/timesheets/entries', 'POST', { projectId, date: day(100), hours: 4, note: tag });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    entryId = e.body.id;
    expect((await api('employee', '/timesheets/entries', 'POST', { projectId, date: day(100), hours: 30 })).status).toBe(400);
    expect((await api('employee', '/timesheets/entries', 'POST', { projectId, date: day(100), hours: -1 })).status).toBe(400);
    expect((await api('employee', `/timesheets/entries/${entryId}`, 'PATCH', { hours: 6 })).status).toBe(200);
    const wk = await api('employee', `/timesheets/entries?weekStart=${day(98)}`);
    expect(JSON.stringify(wk.body)).toContain(entryId);
  });
  test("another employee cannot edit or delete someone else's entry", async () => {
    expect([403, 404]).toContain((await api('employee2', `/timesheets/entries/${entryId}`, 'PATCH', { hours: 1 })).status);
    expect([403, 404]).toContain((await api('employee2', `/timesheets/entries/${entryId}`, 'DELETE')).status);
  });
  test('submit → manager approve; employee cannot approve; manager scope', async () => {
    const s = await api('employee', '/timesheets/submit', 'POST', { weekStart: day(98) });
    expect(s.status, JSON.stringify(s.body)).toBeLessThan(300);
    expect((await api('employee', `/timesheets/entries/${entryId}/approve`, 'PATCH')).status).toBe(403);
    // an entry from an employee who does NOT report to this manager
    const e2 = await api('employee2', '/timesheets/entries', 'POST', { projectId, date: day(101), hours: 2 });
    await api('employee2', '/timesheets/submit', 'POST', { weekStart: day(98) });
    const a = await api('manager', `/timesheets/entries/${e2.body.id}/approve`, 'PATCH');
    expect([403, 404], 'manager approved a non-report timesheet entry: ' + a.status).toContain(a.status);
    expect((await api('manager', `/timesheets/entries/${entryId}/approve`, 'PATCH')).status).toBeLessThan(300);
  });
  test('delete entry then project; project in use is refused or handled', async () => {
    const used = await api('hr', `/timesheets/projects/${projectId}`, 'DELETE');
    expect(used.status, 'deleting a project with entries must not 500').toBeLessThan(500);
    const del = await api('employee', `/timesheets/entries/${entryId}`, 'DELETE');
    expect(del.status).toBeLessThan(500);
    const g = await api('employee', `/timesheets/entries?weekStart=${day(98)}`);
    if (del.status < 300) expect(JSON.stringify(g.body)).not.toContain(entryId);
  });
});

test.describe('Attendance', () => {
  test('clock in/out cycle, double clock-in guarded, logs list, dashboard scoped', async () => {
    const i = await api('employee', '/attendance/clock-in', 'POST', {});
    expect(i.status, JSON.stringify(i.body)).toBeLessThan(300);
    const dup = await api('employee', '/attendance/clock-in', 'POST', {});
    expect(dup.status, 'second clock-in must be refused, not 500').toBeLessThan(500);
    const o = await api('employee', '/attendance/clock-out', 'POST', {});
    expect(o.status, JSON.stringify(o.body)).toBeLessThan(300);
    expect((await api('employee', '/attendance/my-logs')).body.length ?? 1).toBeGreaterThan(0);
    expect((await api('employee', '/attendance/dashboard')).status).toBe(403);
    expect((await api('manager', '/attendance/dashboard')).status).toBe(200);
    const reg = await api('employee', '/attendance/regularization', 'POST', { date: day(-3), reason: tag });
    expect(reg.status).toBeLessThan(500);
  });
});
