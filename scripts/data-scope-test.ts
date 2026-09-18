/**
 * Row/field-level authorization inside one tenant (checklist.md #1) plus cross-tenant write tricks:
 *  - a plain employee must not read colleagues' pay/ID/bank data or their leave/goals/reviews
 *  - managers see their reports, not the whole company
 *  - mass-assignment (body `tenantId`) and foreign-key smuggling (another tenant's ids) are refused
 * Usage: pnpm test:scope   (needs Acme + Globex seeded)
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const API = `${process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001'}/api/v1`;
let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 200)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
};

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }),
  });
  const token = ((await res.json()) as any).accessToken as string;
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${API}${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: r.status, data, text };
  };
  const me = (await call('GET', '/auth/me')).data;
  return { call, me };
}

const SENSITIVE = ['baseSalary', 'cnic', 'bankAccount', 'iban', 'ntn', 'dateOfBirth', 'fatherName', 'currentAddress', 'permanentAddress', 'emergencyContact', 'biometricPin'];
const leaks = (text: string) => SENSITIVE.filter((k) => text.includes(`"${k}"`));
const items = (d: any): any[] => (Array.isArray(d) ? d : d?.data ?? d?.entries ?? []);

async function main() {
  console.log(`Data-scope test -> ${API}\n`);
  const admin = await login('admin@acme.com');
  const hr = await login('hr@acme.com');
  const manager = await login('ali.khan@acme.com');
  const emp = await login('sara.ahmed@acme.com');
  const globex = await login('admin@globex.com');

  const allEmployees = items((await admin.call('GET', '/employees?limit=100')).data);
  const sara = emp.me.employeeId ?? emp.me.employee?.id;
  const ali = manager.me.employeeId ?? manager.me.employee?.id;
  const other = allEmployees.find((e) => e.id !== sara && e.id !== ali && e.managerId !== ali);
  const gEmp = items((await globex.call('GET', '/employees?limit=1')).data)[0];
  const gDept = (await globex.call('GET', '/employees/departments')).data[0];
  const gPolicy = (await globex.call('GET', '/leave/policies')).data[0];
  const gCycle = ((await globex.call('GET', '/performance/cycles')).data ?? [])[0];

  console.log('-- employee: directory view only --');
  const dir = await emp.call('GET', '/employees?limit=100000');
  check('list is capped at 100 rows', items(dir.data).length <= 100);
  check('colleague list carries no pay/ID/bank/address fields', leaks(dir.text).length === 0, leaks(dir.text));
  check('CNIC search is HR-only (no oracle for employees)', items((await emp.call('GET', '/employees?search=42101-1234567-1')).data).length === 0);
  check('...but HR can still search by CNIC', items((await hr.call('GET', '/employees?search=42101-1234567-1')).data).length > 0);
  const oneOther = await emp.call('GET', `/employees/${other.id}`);
  check('a colleague\'s record has no sensitive fields', oneOther.status === 200 && leaks(oneOther.text).length === 0, leaks(oneOther.text));
  check('a colleague\'s record has no salary history/documents', !/"history"|"documents"|"family"/.test(oneOther.text));
  const own = await emp.call('GET', `/employees/${sara}`);
  check('the employee still sees their own full record', own.status === 200 && own.text.includes('"baseSalary"'));

  console.log('\n-- employee: rows limited to their own --');
  const leave = items((await emp.call('GET', '/leave/requests')).data);
  check('leave requests: only their own', leave.length > 0 && leave.every((r) => r.employeeId === sara), leave.length);
  check('leave requests: filtering by someone else returns nothing', items((await emp.call('GET', `/leave/requests?employeeId=${other.id}`)).data).length === 0);
  const onb = items((await emp.call('GET', '/onboarding/progress')).data);
  check('onboarding progress: only their own', onb.every((r) => r.employeeId === sara));
  const goals = items((await emp.call('GET', '/performance/goals')).data);
  check('goals: only their own', goals.every((g) => g.employeeId === sara));
  const reviews = items((await emp.call('GET', '/performance/reviews')).data);
  check('reviews: only ones they are the subject or reviewer of', reviews.every((r) => r.employeeId === sara || r.reviewerId === sara));
  const whos = await emp.call('GET', '/leave/whos-out');
  check('who\'s-out calendar hides the reason for leave', whos.status === 200 && !/"reason"|"rejectionReason"|"attachmentUrl"/.test(whos.text));

  console.log('\n-- employee: cannot write outside their own scope --');
  check('cannot create review cycles (403)', (await emp.call('POST', '/performance/cycles', { name: 'x', startDate: '2026-01-01', endDate: '2026-03-01' })).status === 403);
  check('cannot create reviews (403)', (await emp.call('POST', '/performance/reviews', { cycleId: 'a', employeeId: 'b', reviewerId: 'c' })).status === 403);
  const otherGoal = items((await admin.call('GET', '/performance/goals')).data).find((g) => g.employeeId !== sara);
  if (otherGoal) check('cannot change a colleague\'s goal progress (403)', (await emp.call('PATCH', `/performance/goals/${otherGoal.id}/progress`, { progress: 100 })).status === 403);
  const otherReview = items((await admin.call('GET', '/performance/reviews')).data).find((r) => r.employeeId !== sara && r.reviewerId !== sara);
  if (otherReview) check('cannot submit a review they are not part of (403)', (await emp.call('PATCH', `/performance/reviews/${otherReview.id}`, { selfRating: 5 })).status === 403);
  check('cannot set goals for a colleague (403)', (await emp.call('POST', '/performance/goals', { employeeId: other.id, title: 'x' })).status === 403);
  const enroll = await emp.call('POST', '/lms/enroll', { courseId: ((await emp.call('GET', '/lms/courses')).data[0] ?? {}).id, employeeId: other.id });
  check('lms enrol ignores a supplied employeeId — enrols only themself', enroll.status === 201 && enroll.data.employeeId === sara, enroll.data);
  const otherEnrollment = await admin.call('POST', '/lms/enroll', { courseId: enroll.data.courseId, employeeId: other.id });
  check('cannot change a colleague\'s course progress (403)', (await emp.call('PATCH', `/lms/enrollments/${otherEnrollment.data.id}/progress`, { progress: 100 })).status === 403);
  check('lms progress is range-validated (400)', (await emp.call('PATCH', `/lms/enrollments/${enroll.data.id}/progress`, { progress: 500 })).status === 400);
  check('cannot add documents to a colleague (403)', (await emp.call('POST', `/employees/${other.id}/documents`, { type: 'x', name: 'x', fileUrl: 'https://example.com/a.pdf' })).status === 403);
  const otherOnb = items((await admin.call('GET', '/onboarding/progress')).data).find((r) => r.employeeId !== sara);
  if (otherOnb) {
    const task = otherOnb.tasks?.[0];
    check('cannot complete a colleague\'s onboarding task (403)', (await emp.call('PATCH', `/onboarding/tasks/${otherOnb.id}/${task.taskId}/complete`)).status === 403);
  }

  console.log('\n-- manager: their team, not the company --');
  const team = items((await manager.call('GET', '/employees/team')).data);
  check('team view has no pay/ID/bank fields', leaks(JSON.stringify(team)).length === 0, leaks(JSON.stringify(team)));
  const teamIds = new Set([ali, ...team.map((t) => t.id)]);
  const mLeave = items((await manager.call('GET', '/leave/requests')).data);
  check('leave requests: only self and direct reports', mLeave.every((r) => teamIds.has(r.employeeId)), mLeave.length);
  check('company employee list has no sensitive fields for a manager', leaks((await manager.call('GET', '/employees?limit=100')).text).length === 0);

  console.log('\n-- HR/admin keep full visibility --');
  check('HR list includes pay data', (await hr.call('GET', '/employees?limit=5')).text.includes('"baseSalary"'));
  check('HR sees leave requests beyond one person', new Set(items((await hr.call('GET', '/leave/requests')).data).map((r) => r.employeeId)).size > 1);

  console.log('\n-- mass assignment / foreign-key smuggling refused --');
  const stamp = Date.now();
  check('department: body tenantId rejected (400)', (await admin.call('POST', '/employees/departments', { name: `d${stamp}`, tenantId: globex.me.tenantId })).status === 400);
  check('course: body tenantId rejected (400)', (await admin.call('POST', '/lms/courses', { title: `c${stamp}`, tenantId: globex.me.tenantId })).status === 400);
  check('job: body tenantId rejected (400)', (await admin.call('POST', '/recruitment/jobs', { title: `j${stamp}`, tenantId: globex.me.tenantId })).status === 400);
  check('designation pointing at another tenant\'s department (400)', (await admin.call('POST', '/employees/designations', { name: `x${stamp}`, departmentId: gDept.id })).status === 400);
  check('employee manager from another tenant (400)', (await admin.call('PATCH', `/employees/${other.id}`, { managerId: gEmp.id })).status === 400);
  check('leave request with another tenant\'s policy (400)', (await emp.call('POST', '/leave/requests', { policyId: gPolicy.id, startDate: '2030-01-07', endDate: '2030-01-07' })).status === 400);
  if (gCycle) check('goal in another tenant\'s cycle (400)', (await emp.call('POST', '/performance/goals', { title: 'x', cycleId: gCycle.id })).status === 400);
  check('enrolling in another tenant\'s course fails', (await admin.call('POST', '/lms/enroll', { courseId: gCycle?.id ?? 'nope', employeeId: other.id })).status === 400);
  check('a javascript: document link is rejected (400)', (await admin.call('POST', `/employees/${other.id}/documents`, { type: 'x', name: 'x', fileUrl: 'javascript:alert(1)' })).status === 400);
  check('/dev endpoints need authentication (401)', (await (await fetch(`${API}/dev/seed-bulk`, { method: 'POST' })).status) === 401);

  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
