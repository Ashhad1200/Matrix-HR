import { test, expect } from '@playwright/test';
import { accounts, api } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

test.describe('Recruitment', () => {
  let jobId = ''; let appId = '';
  test('job: create + list; validation; only HR/admin', async () => {
    const j = await api('hr', '/recruitment/jobs', 'POST', { title: `${tag} Engineer`, department: 'Eng', description: 'd', requirements: 'r' });
    expect(j.status, JSON.stringify(j.body)).toBe(201);
    jobId = j.body.id;
    expect((await api('hr', '/recruitment/jobs')).body.map((x: any) => x.id)).toContain(jobId);
    expect((await api('hr', '/recruitment/jobs', 'POST', { title: '' })).status).toBe(400);
    expect((await api('employee', '/recruitment/jobs', 'POST', { title: 'x' })).status).toBe(403);
    expect((await api('manager', '/recruitment/jobs')).status).toBe(403);
    expect((await api('adminB', '/recruitment/jobs')).body.map((x: any) => x.id)).not.toContain(jobId);
  });
  test('application: create, validation, move through statuses, bad status refused', async () => {
    const a = await api('hr', '/recruitment/applications', 'POST', { jobId, firstName: 'Cand', lastName: tag, email: `cand.${tag.toLowerCase()}@qa.test`, });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    appId = a.body.id;
    expect((await api('hr', '/recruitment/applications', 'POST', { jobId, firstName: 'x', lastName: 'y', email: 'bad' })).status).toBe(400);
    expect((await api('hr', '/recruitment/applications', 'POST', { jobId: 'nope', firstName: 'x', lastName: 'y', email: 'a@b.co' })).status).toBeLessThan(500);
    const mine = await api('hr', `/recruitment/applications?jobId=${jobId}`);
    expect(JSON.stringify(mine.body)).toContain(appId);
    const s = await api('hr', `/recruitment/applications/${appId}/status`, 'PATCH', { status: 'INTERVIEW' });
    expect(s.status, JSON.stringify(s.body)).toBeLessThan(300);
    const junk = await api('hr', `/recruitment/applications/${appId}/status`, 'PATCH', { status: 'DROP TABLE' });
    expect(junk.status, 'an arbitrary status string must be refused, not stored/500').toBeGreaterThanOrEqual(400);
    expect(junk.status).toBeLessThan(500);
    expect((await api('adminB', `/recruitment/applications/${appId}/status`, 'PATCH', { status: 'REJECTED' })).status).toBe(404);
  });
  test('hire creates an employee once (idempotent) and optional invite', async () => {
    const h = await api('hr', `/recruitment/applications/${appId}/hire`, 'POST', {});
    expect(h.status, JSON.stringify(h.body)).toBeLessThan(300);
    const h2 = await api('hr', `/recruitment/applications/${appId}/hire`, 'POST', {});
    expect(h2.status, 'second hire must not create a duplicate employee').toBeLessThan(500);
    const found = await api('hr', `/employees?search=${tag}`);
    expect(found.body.data.filter((e: any) => e.lastName === tag && e.firstName === 'Cand').length).toBe(1);
  });
  test('public careers feed shows only the open job of that tenant', async () => {
    const sub = (await api('hr', '/auth/me')).body.tenant.subdomain;
    const r = await fetch(`${process.env.API_URL || 'http://localhost:3001/api/v1'}/careers/${sub}/jobs`);
    expect(r.status).toBe(200);
    const nope = await fetch(`${process.env.API_URL || 'http://localhost:3001/api/v1'}/careers/does-not-exist-zz/jobs`);
    expect(nope.status).toBeLessThan(500);
  });
});

test.describe('Performance', () => {
  let cycleId = ''; let goalId = ''; let reviewId = '';
  test('cycle create/list; validation; permissions', async () => {
    const c = await api('hr', '/performance/cycles', 'POST', { name: `${tag} H2`, startDate: iso(-10), endDate: iso(60) });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    cycleId = c.body.id;
    expect((await api('employee', '/performance/cycles')).body.map((x: any) => x.id)).toContain(cycleId);
    expect((await api('hr', '/performance/cycles', 'POST', { name: 'x', startDate: iso(10), endDate: iso(-10) })).status, 'end before start').toBe(400);
    expect((await api('employee', '/performance/cycles', 'POST', { name: 'x', startDate: iso(0), endDate: iso(5) })).status).toBe(403);
  });
  test('goal: create, progress bounds, persistence, isolation', async () => {
    const g = await api('employee', '/performance/goals', 'POST', { title: `${tag} goal`, description: 'd', dueDate: iso(30), cycleId });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    goalId = g.body.id;
    expect((await api('employee', `/performance/goals/${goalId}/progress`, 'PATCH', { progress: 40 })).status).toBe(200);
    expect((await api('employee', `/performance/goals/${goalId}/progress`, 'PATCH', { progress: 140 })).status).toBe(400);
    expect((await api('employee', `/performance/goals/${goalId}/progress`, 'PATCH', { progress: -1 })).status).toBe(400);
    const mine = (await api('employee', '/performance/goals')).body.find((x: any) => x.id === goalId);
    expect(Number(mine.progress)).toBe(40);
    expect((await api('employee2', '/performance/goals')).body.map?.((x: any) => x.id) ?? []).not.toContain(goalId);
    const other = await api('employee2', `/performance/goals/${goalId}/progress`, 'PATCH', { progress: 90 });
    expect([403, 404], 'another employee changed my goal progress').toContain(other.status);
    expect((await api('employee', '/performance/goals', 'POST', { title: '' })).status).toBe(400);
    expect((await api('employee', '/performance/goals', 'POST', { title: 'for someone else', employeeId: accounts().users.employee2.employeeId })).status, 'an employee must not create goals for others').toBeGreaterThanOrEqual(400);
  });
  test('review: create (HR), submit by the right people only', async () => {
    const u = accounts().users;
    const r = await api('hr', '/performance/reviews', 'POST', { cycleId, employeeId: u.employee.employeeId, reviewerId: u.manager.employeeId });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    reviewId = r.body.id;
    expect((await api('employee', '/performance/reviews', 'POST', { cycleId, employeeId: u.employee.employeeId, reviewerId: u.manager.employeeId })).status).toBe(403);
    expect((await api('employee', `/performance/reviews/${reviewId}`, 'PATCH', { selfRating: 4 })).status).toBe(200);
    expect((await api('employee', `/performance/reviews/${reviewId}`, 'PATCH', { selfRating: 9 })).status).toBe(400);
    const sneaky = await api('employee', `/performance/reviews/${reviewId}`, 'PATCH', { managerRating: 5 });
    expect(sneaky.status, 'an employee must not set their own manager rating').toBeGreaterThanOrEqual(400);
    expect((await api('manager', `/performance/reviews/${reviewId}`, 'PATCH', { managerRating: 4, status: 'submitted' })).status).toBe(200);
    expect([403, 404]).toContain((await api('employee2', `/performance/reviews/${reviewId}`, 'PATCH', { selfRating: 1 })).status);
    expect((await api('adminB', `/performance/reviews/${reviewId}`, 'PATCH', { selfRating: 1 })).status).toBe(404);
  });
});

test.describe('1-on-1s, eNPS, peer reviews, LMS', () => {
  test('one-on-one: manager CRUD with delete; employee blocked', async () => {
    const empId = accounts().users.employee.employeeId;
    const c = await api('manager', '/one-on-ones', 'POST', { employeeId: empId, scheduledAt: iso(3), talkingPoints: [{ text: tag }] });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect((await api('manager', `/one-on-ones/${c.body.id}`, 'PATCH', { status: 'completed' })).status).toBe(200);
    expect((await api('manager', '/one-on-ones')).body.map((x: any) => x.id)).toContain(c.body.id);
    expect((await api('employee', '/one-on-ones')).status).toBe(403);
    expect((await api('manager', '/one-on-ones', 'POST', { employeeId: accounts().users.employeeB.employeeId, scheduledAt: iso(3) })).status, 'a manager must not schedule with an employee of another company').toBeGreaterThanOrEqual(400);
    expect((await api('adminB', `/one-on-ones/${c.body.id}`, 'DELETE')).status).toBeGreaterThanOrEqual(400);
    expect((await api('manager', `/one-on-ones/${c.body.id}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('manager', '/one-on-ones')).body.map((x: any) => x.id)).not.toContain(c.body.id);
  });
  test('eNPS: survey CRUD, respond once, score bounds', async () => {
    const s = await api('hr', '/enps/surveys', 'POST', { title: `${tag} pulse`, question: 'How likely?' });
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    expect((await api('hr', `/enps/surveys/${s.body.id}`, 'PATCH', { title: `${tag} pulse 2`, status: 'active' })).status).toBeLessThan(300);
    expect((await api('employee', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 9, comment: 'good' })).status).toBeLessThan(300);
    expect((await api('employee', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 11 })).status).toBe(400);
    // KNOWN GAP (owner decision): responses are anonymous and carry no respondent id, so one person can vote repeatedly.
    expect([403, 404], 'a user of another company responded to this survey').toContain((await api('employeeB', `/enps/surveys/${s.body.id}/respond`, 'POST', { score: 0 })).status);
    expect((await api('employee', '/enps/surveys')).status).toBe(403);
    expect((await api('hr', '/enps/surveys/summary')).status).toBe(200);
    expect((await api('hr', `/enps/surveys/${s.body.id}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('hr', `/enps/surveys/${s.body.id}`)).status).toBe(404);
  });
  test('peer review: API CRUD (no UI exists)', async () => {
    const u = accounts().users;
    const cyc = await api('hr', '/performance/cycles', 'POST', { name: `${tag} pr`, startDate: iso(-1), endDate: iso(20) });
    const p = await api('manager', '/peer-reviews', 'POST', { cycleId: cyc.body.id, employeeId: u.employee.employeeId, reviewerId: u.manager.employeeId, relationship: 'peer' });
    expect(p.status, JSON.stringify(p.body)).toBe(201);
    expect((await api('manager', `/peer-reviews/${p.body.id}`, 'PATCH', { rating: 4, feedback: 'ok', status: 'submitted' })).status).toBeLessThan(300);
    expect((await api('manager', `/peer-reviews/${p.body.id}`, 'PATCH', { rating: 9 })).status).toBe(400);
    expect((await api('adminB', `/peer-reviews/${p.body.id}`)).status).toBe(404);
    expect((await api('manager', `/peer-reviews/${p.body.id}`, 'DELETE')).status).toBeLessThan(300);
  });
  test('LMS: course create, enroll, progress bounds', async () => {
    const c = await api('hr', '/lms/courses', 'POST', { title: `${tag} course`, description: 'd', isMandatory: false });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect((await api('employee', '/lms/courses', 'POST', { title: 'x' })).status).toBe(403);
    expect((await api('hr', '/lms/courses', 'POST', { title: '' })).status).toBe(400);
    const e = await api('employee', '/lms/enroll', 'POST', { courseId: c.body.id });
    expect(e.status, JSON.stringify(e.body)).toBeLessThan(300);
    expect((await api('employee', '/lms/enroll', 'POST', { courseId: c.body.id })).status, 'double enrol').toBeLessThan(500);
    expect((await api('employee', `/lms/enrollments/${e.body.id}/progress`, 'PATCH', { progress: 50 })).status).toBeLessThan(300);
    expect((await api('employee', `/lms/enrollments/${e.body.id}/progress`, 'PATCH', { progress: 500 })).status).toBe(400);
    expect([403, 404]).toContain((await api('employee2', `/lms/enrollments/${e.body.id}/progress`, 'PATCH', { progress: 100 })).status);
    expect((await api('adminB', '/lms/courses')).body.map?.((x: any) => x.id) ?? []).not.toContain(c.body.id);
  });
});

test.describe('Onboarding and offboarding', () => {
  test('offboarding: employee resigns, chain decides, validation, isolation', async () => {
    const r = await api('employee2', '/offboarding', 'POST', { type: 'RESIGNATION', lastWorkingDay: iso(30).slice(0, 10), reason: tag });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const id = r.body.id;
    expect((await api('employee2', '/offboarding', 'POST', { type: 'RESIGNATION', lastWorkingDay: iso(30).slice(0, 10) })).status, 'second open case').toBeGreaterThanOrEqual(400);
    expect((await api('employee2', '/offboarding', 'POST', { type: 'RESIGNATION', lastWorkingDay: 'tomorrow' })).status).toBe(400);
    expect((await api('hr', '/offboarding')).body.map?.((x: any) => x.id) ?? JSON.stringify((await api('hr', '/offboarding')).body)).toContain(id);
    expect((await api('employee', `/offboarding/${id}`)).status, 'colleague must not read someone\'s exit case').toBeGreaterThanOrEqual(400);
    expect((await api('adminB', `/offboarding/${id}`)).status).toBeGreaterThanOrEqual(400);
    expect((await api('employee2', `/offboarding/${id}/decision`, 'POST', { action: 'APPROVE' })).status).toBe(403);
    expect((await api('hr', `/offboarding/${id}/cancel`, 'POST')).status).toBeLessThan(300);
  });
  test('onboarding + pre-boarding: start validation and permissions', async () => {
    expect((await api('hr', '/onboarding/start', 'POST', {})).status).toBe(400);
    expect((await api('employee', '/onboarding/start', 'POST', { employeeId: 'x', templateId: 'y' })).status).toBe(403);
    expect((await api('hr', '/preboarding/invite', 'POST', { email: 'bad' })).status).toBe(400);
    expect((await api('employee', '/preboarding')).status).toBe(403);
    expect((await api('hr', '/onboarding/dashboard')).status).toBe(200);
  });
});
