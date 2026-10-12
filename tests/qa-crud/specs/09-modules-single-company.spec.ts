/** API checks for the new create/edit endpoints, and a second API instance running in single-company mode. */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import { accounts, api, API } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

test.describe('Recruitment: edit / close / reopen a job', () => {
  test('job lifecycle, validation, isolation', async () => {
    const j = await api('hr', '/recruitment/jobs', 'POST', { title: `${tag} job` });
    const id = j.body.id;
    expect((await api('hr', `/recruitment/jobs/${id}`, 'PATCH', { title: `${tag} job v2`, department: 'Eng', description: 'd', requirements: 'r' })).status).toBe(200);
    const closed = await api('hr', `/recruitment/jobs/${id}`, 'PATCH', { status: 'closed' });
    expect(closed.body.status).toBe('closed'); expect(closed.body.closedAt).toBeTruthy();
    const reopened = await api('hr', `/recruitment/jobs/${id}`, 'PATCH', { status: 'open' });
    expect(reopened.body.closedAt).toBeNull();
    expect((await api('hr', `/recruitment/jobs/${id}`, 'PATCH', { status: 'bogus' })).status).toBe(400);
    expect((await api('hr', `/recruitment/jobs/${id}`, 'PATCH', { title: '' })).status).toBe(400);
    expect((await api('employee', `/recruitment/jobs/${id}`, 'PATCH', { title: 'x' })).status).toBe(403);
    expect((await api('adminB', `/recruitment/jobs/${id}`, 'PATCH', { title: 'x' })).status).toBe(404);
    expect((await api('hr', '/recruitment/jobs')).body.find((x: any) => x.id === id).title).toBe(`${tag} job v2`);
  });
});

test.describe('Performance: edit a cycle and a goal', () => {
  test('cycle edit validates dates; goal edit is owner/manager/HR only', async () => {
    const c = await api('hr', '/performance/cycles', 'POST', { name: `${tag} cyc`, startDate: iso(-1), endDate: iso(30) });
    expect((await api('hr', `/performance/cycles/${c.body.id}`, 'PATCH', { name: `${tag} cyc2`, status: 'COMPLETED' })).status).toBe(200);
    expect((await api('hr', `/performance/cycles/${c.body.id}`, 'PATCH', { endDate: iso(-5) })).status, 'end before start').toBe(400);
    expect((await api('employee', `/performance/cycles/${c.body.id}`, 'PATCH', { name: 'x' })).status).toBe(403);
    expect((await api('adminB', `/performance/cycles/${c.body.id}`, 'PATCH', { name: 'x' })).status).toBe(404);
    const g = await api('employee', '/performance/goals', 'POST', { title: `${tag} goal` });
    expect((await api('employee', `/performance/goals/${g.body.id}`, 'PATCH', { title: `${tag} goal 2`, dueDate: iso(20), description: 'd' })).status).toBe(200);
    expect((await api('manager', `/performance/goals/${g.body.id}`, 'PATCH', { description: 'mgr' })).status).toBe(200); // direct report
    expect((await api('employee2', `/performance/goals/${g.body.id}`, 'PATCH', { title: 'x' })).status).toBe(403);
    expect((await api('adminB', `/performance/goals/${g.body.id}`, 'PATCH', { title: 'x' })).status).toBe(404);
    expect((await api('employee', `/performance/goals/${g.body.id}`, 'PATCH', { title: '' })).status).toBe(400);
  });
});

test.describe('Onboarding templates', () => {
  test('create, edit, switch off; start; tasks lock once started', async () => {
    const t = await api('hr', '/onboarding/templates', 'POST', { name: `${tag} tpl`, tasks: [{ title: 'Sign contract' }, { title: 'Get laptop', phase: 'week1', assignee: 'it' }] });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    expect(t.body.tasks.map((x: any) => x.title)).toEqual(['Sign contract', 'Get laptop']);
    expect((await api('hr', '/onboarding/templates', 'POST', { name: 'x', tasks: [] })).status, 'at least one task').toBe(400);
    expect((await api('hr', '/onboarding/templates', 'POST', { name: 'x', tasks: [{ title: 'a', phase: 'never' }] })).status).toBe(400);
    expect((await api('employee', '/onboarding/templates', 'POST', { name: 'x', tasks: [{ title: 'a' }] })).status).toBe(403);
    const edit = await api('hr', `/onboarding/templates/${t.body.id}`, 'PATCH', { name: `${tag} tpl 2`, tasks: [{ title: 'Only one' }] });
    expect(edit.body.tasks).toHaveLength(1);
    expect((await api('adminB', `/onboarding/templates/${t.body.id}`, 'PATCH', { name: 'x' })).status).toBe(404);
    const st = await api('hr', '/onboarding/start', 'POST', { employeeId: accounts().users.employee.employeeId, templateId: t.body.id });
    expect(st.status, JSON.stringify(st.body)).toBeLessThan(300);
    expect((await api('hr', `/onboarding/templates/${t.body.id}`, 'PATCH', { tasks: [{ title: 'changed' }] })).status, 'tasks lock after a start').toBe(400);
    expect((await api('hr', `/onboarding/templates/${t.body.id}`, 'PATCH', { isActive: false })).status).toBe(200);
    expect((await api('hr', '/onboarding/templates')).body.map((x: any) => x.id)).not.toContain(t.body.id);
  });
});

test.describe('Learning', () => {
  test('edit, archive, my enrolments, progress', async () => {
    const c = await api('hr', '/lms/courses', 'POST', { title: `${tag} course` });
    expect((await api('hr', `/lms/courses/${c.body.id}`, 'PATCH', { title: `${tag} course 2`, description: 'd', isMandatory: true })).status).toBe(200);
    const en = await api('employee', '/lms/enroll', 'POST', { courseId: c.body.id });
    const mine = await api('employee', '/lms/my-enrollments');
    expect(mine.body.find((m: any) => m.id === en.body.id).course.title).toBe(`${tag} course 2`);
    expect((await api('employee2', '/lms/my-enrollments')).body.map((m: any) => m.id)).not.toContain(en.body.id);
    expect((await api('employee', `/lms/enrollments/${en.body.id}/progress`, 'PATCH', { progress: 100 })).status).toBeLessThan(300);
    expect((await api('employee', `/lms/courses/${c.body.id}`, 'PATCH', { title: 'x' })).status).toBe(403);
    expect((await api('adminB', `/lms/courses/${c.body.id}`, 'PATCH', { title: 'x' })).status).toBe(404);
    expect((await api('hr', `/lms/courses/${c.body.id}`, 'PATCH', { status: 'ARCHIVED' })).status).toBe(200);
    expect((await api('employee', '/lms/courses')).body.map((x: any) => x.id)).not.toContain(c.body.id);
  });
});

test.describe('Single-company mode (a second API instance)', () => {
  let child: ChildProcess; const PORT = 3002; const BASE = `http://localhost:${PORT}/api/v1`;
  test.beforeAll(async () => {
    child = spawn('node', ['dist/main.js'], {
      cwd: new URL('../../../apps/api', `file://${__dirname}/`).pathname,
      env: { ...process.env, PORT: String(PORT), SINGLE_COMPANY_MODE: 'true', BILLING_WORKER: 'off',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://matrixhr:matrixhr@127.0.0.1:5433/matrixhr', REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6380',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-0123456789-abcdefghijklmnop', JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-0123456789-abcdefghijklmnopq',
        S3_ENDPOINT: 'http://127.0.0.1:9000', S3_ACCESS_KEY: 'S3RVER', S3_SECRET_KEY: 'S3RVER', S3_BUCKET: 'matrixhr', THROTTLE_LIMIT: '100000', AUTH_THROTTLE_LIMIT: '100000' },
      stdio: 'ignore',
    });
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 1000)); }
    throw new Error('single-company API did not start');
  });
  test.afterAll(() => { child?.kill(); });

  const call = async (token: string | null, path: string, method = 'GET', body?: unknown) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j };
  };

  test('every module is on with no plan; no billing, trial or credits; sign-up closed', async () => {
    // a company on the Starter plan, ACTIVE (not trial): on the normal server plan-gated modules are refused
    const s = Math.random().toString(36).slice(2, 8);
    const su = await (await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `sc-${s}@qa.test`, password: 'ZzTest#Passw0rd1', companyName: `${tag} sc`, subdomain: `zz-sc-${s}` }) })).json();
    await api('superadmin', `/platform/tenants/${su.tenant.id}/subscription/status`, 'PATCH', { status: 'active' });
    expect((await fetch(`${API}/custom-fields`, { headers: { authorization: `Bearer ${su.accessToken}` } })).status).toBe(403);
    // same login on the single-company server
    const login = await call(null, '/auth/login', 'POST', { email: `sc-${s}@qa.test`, password: 'ZzTest#Passw0rd1' });
    expect(login.status).toBeLessThan(300);
    const t = login.body.accessToken;
    expect((await call(t, '/custom-fields')).status).toBe(200);
    expect((await call(t, '/webhooks')).status).toBe(200);
    expect((await call(t, '/billing/state')).status).toBe(404);
    expect((await call(t, '/billing/catalog')).status).toBe(404);
    const me = await call(t, '/auth/me');
    expect(me.body.deployment).toEqual({ singleCompany: true });
    expect(me.body.billing).toBeNull();
    expect(me.body.permissions.nav.map((n: any) => n.href)).not.toContain('/billing');
    expect(me.body.permissions.nav.map((n: any) => n.href)).toContain('/employees');
    const closed = await call(null, '/auth/signup', 'POST', { email: `x-${s}@qa.test`, password: 'ZzTest#Passw0rd1', companyName: 'x co', subdomain: `zz-x-${s}` });
    expect(closed.status).toBe(403);
    expect(closed.body.message).toMatch(/closed/i);
    const ai = await call(t, '/ai/status');
    expect(ai.body.unlimited).toBe(true);
    expect((await call(null, '/pricing')).status, 'a single-company install shows no prices').toBe(404);
  });
  test('a lapsed period never blocks a single-company install', async () => {
    const s = Math.random().toString(36).slice(2, 8);
    const su = await (await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `lp-${s}@qa.test`, password: 'ZzTest#Passw0rd1', companyName: `${tag} lp`, subdomain: `zz-lp-${s}` }) })).json();
    await api('superadmin', `/platform/billing/tenants/${su.tenant.id}/period`, 'PUT', { periodEnd: iso(-30), reason: 'ZZ lapse test' });
    expect((await fetch(`${API}/employees`, { headers: { authorization: `Bearer ${su.accessToken}` } })).status, 'blocked on the normal server').toBe(403);
    const login = await call(null, '/auth/login', 'POST', { email: `lp-${s}@qa.test`, password: 'ZzTest#Passw0rd1' });
    expect((await call(login.body.accessToken, '/employees')).status).toBe(200);
  });
});
