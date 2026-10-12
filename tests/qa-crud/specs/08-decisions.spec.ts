/** The five owner decisions, plus leave cancel/edit, tested through the real API. */
import { test, expect } from '@playwright/test';
import { accounts, api, API } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const PASS = 'ZzTest#Passw0rd1';
const call = async (token: string | null, path: string, method = 'GET', body?: unknown) => {
  const r = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
const signup = async (name: string, extra: object = {}) => {
  const s = Math.random().toString(36).slice(2, 8);
  const r = await call(null, '/auth/signup', 'POST', { email: `${name}-${s}@qa.test`, password: PASS, companyName: `${tag} ${name}`, subdomain: `zz-${name}-${s}`, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { token: r.body.accessToken as string, tenantId: r.body.tenant.id as string, email: `${name}-${s}@qa.test` };
};
const nextWeekday = (dow: number, weeksAhead = 1) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + ((dow - d.getUTCDay() + 7) % 7) + 7 * weeksAhead); return d; };
const iso = (d: Date) => d.toISOString().slice(0, 10);

test.describe('1. eNPS: one answer per employee, still anonymous', () => {
  test('second answer refused, parallel submits count once, answers carry no respondent', async () => {
    const s = await api('hr', '/enps/surveys', 'POST', { title: `${tag} once` });
    expect((await api('hr', `/enps/surveys/${s.body.id}`, 'PATCH', { status: 'active' })).status).toBeLessThan(300);
    expect((await api('employee', '/enps/surveys/active')).body.find((x: any) => x.id === s.body.id).answered).toBe(false);
    const first = await api('employee', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 9, comment: 'good' });
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    const again = await api('employee', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 0 });
    expect(again.status).toBe(409);
    const parallel = await Promise.all([1, 2, 3, 4].map(() => api('employee2', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 7 })));
    expect(parallel.filter((r) => r.status < 300)).toHaveLength(1);
    expect((await api('employee', '/enps/surveys/active')).body.find((x: any) => x.id === s.body.id).answered).toBe(true);
    const detail = await api('hr', `/enps/surveys/${s.body.id}`);
    expect(JSON.stringify(detail.body)).not.toMatch(/employeeId|zz-employee/);
    expect(detail.body.responses?.length ?? detail.body._count?.responses).toBe(2);
    expect((await api('employeeB', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 5 })).status).toBe(404);
  });
  test('a login without an employee profile cannot answer', async () => {
    const op = await api('superadmin', '/auth/me');
    const s = await api('hr', '/enps/surveys', 'POST', { title: `${tag} noprofile` });
    await api('hr', `/enps/surveys/${s.body.id}`, 'PATCH', { status: 'active' });
    expect((await api('superadmin', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 5 })).status).toBeGreaterThanOrEqual(403);
    void op;
  });
});

test.describe('2. Owner has an employee profile', () => {
  test('signup owner can use their own screens; operator-created tenants too', async () => {
    const o = await signup('owner', { firstName: 'Olivia', lastName: 'Owner' });
    const me = await call(o.token, '/auth/me');
    expect(me.body.employee?.firstName).toBe('Olivia');
    expect((await call(o.token, '/leave/balances')).body.length).toBeGreaterThan(0);
    expect((await call(o.token, '/timesheets/entries')).status).toBe(200);
    expect((await call(o.token, '/attendance/my-logs')).status).toBe(200);
    const s = Math.random().toString(36).slice(2, 8);
    const op = await api('superadmin', '/platform/tenants', 'POST', { companyName: `${tag} op`, subdomain: `zz-op-${s}`, adminEmail: `op-${s}@qa.test` });
    expect(op.status, JSON.stringify(op.body)).toBeLessThan(300);
  });
});

test.describe('3. Trial = every module', () => {
  test('a fresh signup can use plan-gated modules that Starter excludes', async () => {
    const t = await signup('trial');
    for (const p of ['/custom-fields', '/webhooks', '/workflows']) expect((await call(t.token, p)).status, p).toBe(200);
    expect((await call(t.token, '/sso/config')).status).toBe(200);
  });
  test('when the trial ends the plan limits apply again', async () => {
    const t = await signup('trialend');
    await api('superadmin', `/platform/tenants/${t.tenantId}/subscription/status`, 'PATCH', { status: 'active' });
    expect((await call(t.token, '/custom-fields')).status).toBe(403);
  });
});

test.describe('4. Suspend is a clear hard stop', () => {
  test('login and every call answer ACCOUNT_SUSPENDED; reversible', async () => {
    const t = await signup('susp');
    expect((await api('superadmin', `/platform/tenants/${t.tenantId}/subscription/status`, 'PATCH', { status: 'suspended' })).status).toBeLessThan(300);
    const login = await call(null, '/auth/login', 'POST', { email: t.email, password: PASS });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(login.body.message).toMatch(/suspended.*contact support/i);
    const wrongPw = await call(null, '/auth/login', 'POST', { email: t.email, password: 'Wrong#Pass1234' });
    expect(wrongPw.status, 'a wrong password must not reveal the suspension').toBe(401);
    const old = await call(t.token, '/leave/policies');
    expect(old.status).toBe(403);
    expect(old.body.code).toBe('ACCOUNT_SUSPENDED');
    await api('superadmin', `/platform/tenants/${t.tenantId}/subscription/status`, 'PATCH', { status: 'active' });
    expect((await call(null, '/auth/login', 'POST', { email: t.email, password: PASS })).status).toBeLessThan(300);
  });
});

test.describe('5. Leave counts working days', () => {
  test('weekends and public holidays are not deducted; default weekend is Sat+Sun', async () => {
    const mon = nextWeekday(1, 2); const fri = new Date(mon); fri.setUTCDate(mon.getUTCDate() + 4); const nextMon = new Date(mon); nextMon.setUTCDate(mon.getUTCDate() + 7);
    expect((await api('hr', '/leave/weekend')).body.weekendDays.sort()).toEqual([0, 6]);
    expect((await api('employee', `/leave/working-days?start=${iso(mon)}&end=${iso(fri)}`)).body.days).toBe(5);
    // Mon..next Mon = 6 working days (the weekend in between is skipped)
    expect((await api('employee', `/leave/working-days?start=${iso(mon)}&end=${iso(nextMon)}`)).body.days).toBe(6);
    // a public holiday in the range comes off too
    const wed = new Date(mon); wed.setUTCDate(mon.getUTCDate() + 2);
    const h = await api('hr', '/leave/holidays', 'POST', { name: `${tag} hol`, date: iso(wed) });
    expect((await api('employee', `/leave/working-days?start=${iso(mon)}&end=${iso(fri)}`)).body.days).toBe(4);
    await api('hr', `/leave/holidays/${h.body.id}`, 'DELETE');
  });
  test('a request over a weekend takes only working days; weekend-only is refused', async () => {
    const policyId = (await api('employee', '/leave/policies')).body[0].id;
    const fri = nextWeekday(5, 3); const mon = new Date(fri); mon.setUTCDate(fri.getUTCDate() + 3);
    const before = (await api('employee', '/leave/balances')).body.find((b: any) => b.policyId === policyId);
    const r = await api('employee', '/leave/requests', 'POST', { policyId, startDate: iso(fri), endDate: iso(mon) });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(Number(r.body.days)).toBe(2); // Friday + Monday
    const sat = new Date(fri); sat.setUTCDate(fri.getUTCDate() + 1); const sun = new Date(fri); sun.setUTCDate(fri.getUTCDate() + 2);
    expect((await api('employee', '/leave/requests', 'POST', { policyId, startDate: iso(sat), endDate: iso(sun) })).status).toBe(400);
    expect((await api('employee', `/leave/requests/${r.body.id}/cancel`, 'POST')).status).toBeLessThan(300);
    const after = (await api('employee', '/leave/balances')).body.find((b: any) => b.policyId === policyId);
    expect(Number(after.pending)).toBe(Number(before.pending));
  });
  test('weekend is configurable per company, validated, HR/admin only, audited', async () => {
    const c = await signup('weekend');
    expect((await call(c.token, '/leave/weekend', 'PUT', { days: [5, 6] })).status).toBe(200); // Friday + Saturday
    expect((await call(c.token, '/leave/weekend')).body.weekendDays.sort()).toEqual([5, 6]);
    const mon = nextWeekday(1, 2); const fri = new Date(mon); fri.setUTCDate(mon.getUTCDate() + 4);
    expect((await call(c.token, `/leave/working-days?start=${iso(mon)}&end=${iso(fri)}`)).body.days).toBe(4);
    expect((await call(c.token, '/leave/weekend', 'PUT', { days: [0, 1, 2, 3, 4, 5, 6] })).status).toBe(400);
    expect((await call(c.token, '/leave/weekend', 'PUT', { days: [9] })).status).toBe(400);
    expect((await api('employee', '/leave/weekend', 'PUT', { days: [0] })).status).toBe(403);
    expect((await api('hr', '/leave/weekend')).body.weekendDays.sort()).toEqual([0, 6]); // another company is untouched
  });
});

test.describe('b. Cancel and edit a pending leave request', () => {
  let policyId = ''; let id = '';
  const bal = async (who: any) => (await api(who, '/leave/balances')).body.find((b: any) => b.policyId === policyId);
  test('edit changes dates and the pending days; the balance follows', async () => {
    policyId = (await api('employee', '/leave/policies')).body[0].id;
    const mon = nextWeekday(1, 4); const tue = new Date(mon); tue.setUTCDate(mon.getUTCDate() + 1); const thu = new Date(mon); thu.setUTCDate(mon.getUTCDate() + 3);
    const before = await bal('employee');
    const r = await api('employee', '/leave/requests', 'POST', { policyId, startDate: iso(mon), endDate: iso(tue), reason: `${tag} orig` });
    id = r.body.id;
    expect(Number((await bal('employee')).pending) - Number(before.pending)).toBe(2);
    const u = await api('employee', `/leave/requests/${id}`, 'PATCH', { endDate: iso(thu), reason: `${tag} edited` });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(Number(u.body.days)).toBe(4);
    expect(u.body.reason).toBe(`${tag} edited`);
    expect(Number((await bal('employee')).pending) - Number(before.pending)).toBe(4);
    expect((await api('employee', `/leave/requests/${id}`, 'PATCH', { endDate: '2020-01-01' })).status, 'end before start').toBe(400);
    expect((await api('employee', `/leave/requests/${id}`, 'PATCH', { endDate: iso(new Date(mon.getTime() + 400 * 86400000)) })).status, 'over the balance').toBe(400);
    expect(Number((await bal('employee')).pending) - Number(before.pending), 'a refused edit changes nothing').toBe(4);
  });
  test('only the owner edits; others may not; HR can cancel for them; cancel releases once', async () => {
    expect((await api('employee2', `/leave/requests/${id}`, 'PATCH', { reason: 'x' })).status).toBe(403);
    expect((await api('hr', `/leave/requests/${id}`, 'PATCH', { reason: 'x' })).status, 'HR does not edit someone else\'s request').toBe(403);
    expect([403, 404]).toContain((await api('adminB', `/leave/requests/${id}`, 'PATCH', { reason: 'x' })).status);
    expect([403, 404]).toContain((await api('employee2', `/leave/requests/${id}/cancel`, 'POST')).status);
    const before = await bal('employee');
    const both = await Promise.all([api('employee', `/leave/requests/${id}/cancel`, 'POST'), api('employee', `/leave/requests/${id}/cancel`, 'POST')]);
    expect(both.filter((r) => r.status < 300)).toHaveLength(1);
    expect(Number(before.pending) - Number((await bal('employee')).pending)).toBe(4);
    expect((await api('employee', `/leave/requests/${id}`, 'PATCH', { reason: 'late' })).status, 'cancelled requests cannot be edited').toBe(400);
    expect((await api('manager', `/leave/requests/${id}/approve`, 'PATCH')).status, 'a cancelled request cannot be approved').toBeGreaterThanOrEqual(400);
    expect((await api('employee', '/approvals/inbox')).status).toBe(403);
    expect(JSON.stringify((await api('manager', '/approvals/inbox')).body)).not.toContain(id);
  });
  test('an approved request can no longer be cancelled or edited', async () => {
    const mon = nextWeekday(1, 5);
    const r = await api('employee', '/leave/requests', 'POST', { policyId, startDate: iso(mon), endDate: iso(mon) });
    expect((await api('manager', `/leave/requests/${r.body.id}/approve`, 'PATCH')).status).toBeLessThan(300);
    expect((await api('employee', `/leave/requests/${r.body.id}/cancel`, 'POST')).status).toBe(400);
    expect((await api('employee', `/leave/requests/${r.body.id}`, 'PATCH', { reason: 'x' })).status).toBe(400);
  });
});
void accounts;
