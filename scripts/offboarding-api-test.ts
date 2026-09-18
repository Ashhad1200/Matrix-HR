/**
 * Phase 3 verification: shared workflow engine (leave + offboarding),
 * separation of duties, object-level authorization, full offboarding cycle.
 * Usage: pnpm test:offboarding   (stack must be running on localhost:3001)
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const API = `${process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001'}/api/v1`;
const PASSWORD = 'Password123!';

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
}

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body: any = await res.json();
  if (!body.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(body)}`);
  return body.accessToken as string;
}

function client(token: string) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

async function main() {
  console.log(`Phase 3 workflow + offboarding test -> ${API}\n`);
  const admin = client(await login('admin@acme.com'));
  const hr = client(await login('hr@acme.com'));
  const manager = client(await login('ali.khan@acme.com'));
  const employee = client(await login('sara.ahmed@acme.com'));

  const aliMe = (await manager('GET', '/auth/me')).data;
  const aliEmployeeId = aliMe.employeeId ?? aliMe.employee?.id;

  // ── Throwaway employee reporting to Ali (so the MANAGER step is real) ────
  const code = `OFF${Date.now().toString().slice(-8)}`;
  const created = await admin('POST', '/employees', {
    employeeCode: code, firstName: 'Offboard', lastName: 'Tester', baseSalary: 120000, managerId: aliEmployeeId,
    dateOfJoining: '2024-01-01',
  });
  check('create throwaway employee', created.status === 201, created);
  const empId = created.data.id;
  if (!empId) throw new Error('cannot continue without throwaway employee');

  console.log('\n-- initiation authorization --');
  const lwd = new Date().toISOString().slice(0, 10);
  check('plain employee cannot list all cases (403)', (await employee('GET', '/offboarding')).status === 403);
  const asEmployeeOnOther = await employee('POST', '/offboarding', { employeeId: empId, type: 'TERMINATION', lastWorkingDay: lwd });
  // Non-HR callers are forced onto their own record as a RESIGNATION, never someone else's.
  check('employee cannot initiate for another employee', asEmployeeOnOther.status !== 201 || asEmployeeOnOther.data.employeeId !== empId, asEmployeeOnOther);
  if (asEmployeeOnOther.status === 201) await hr('POST', `/offboarding/${asEmployeeOnOther.data.id}/cancel`);

  const started = await hr('POST', '/offboarding', { employeeId: empId, type: 'RESIGNATION', lastWorkingDay: lwd, reason: 'e2e test' });
  check('HR initiates resignation', started.status === 201 && started.data.status === 'PENDING_APPROVAL', started);
  const caseId = started.data.id;
  check('workflow awaiting MANAGER first', started.data.approvals?.awaitingRole === 'MANAGER', started.data.approvals);
  check('duplicate open case is rejected', (await hr('POST', '/offboarding', { employeeId: empId, type: 'RESIGNATION', lastWorkingDay: lwd })).status === 400);

  console.log('\n-- approval chain / segregation of duties --');
  check('unrelated employee cannot read the case (403)', (await employee('GET', `/offboarding/${caseId}`)).status === 403);
  check('employee cannot decide (403)', (await employee('POST', `/offboarding/${caseId}/decision`, { action: 'APPROVE' })).status === 403);
  check('initiator (HR) cannot skip the manager step', (await hr('POST', `/offboarding/${caseId}/decision`, { action: 'APPROVE' })).status === 403);
  const step0 = await manager('POST', `/offboarding/${caseId}/decision`, { action: 'APPROVE' });
  check('direct manager approves step 1', step0.status === 201 && step0.data.approvals?.awaitingRole === 'HR_MANAGER', step0);
  check('initiator (HR) cannot approve own request at step 2', (await hr('POST', `/offboarding/${caseId}/decision`, { action: 'APPROVE' })).status === 403);
  const step1 = await admin('POST', `/offboarding/${caseId}/decision`, { action: 'APPROVE' });
  check('admin (higher rank) approves step 2 -> CLEARANCE', step1.status === 201 && step1.data.status === 'CLEARANCE', step1);
  check('4 clearance items generated', step1.data.clearanceItems?.length === 4, step1.data.clearanceItems);
  check('re-approving a finished workflow fails', (await admin('POST', `/offboarding/${caseId}/decision`, { action: 'APPROVE' })).status === 400);

  console.log('\n-- clearance --');
  const items: any[] = step1.data.clearanceItems;
  const byRole = (r: string) => items.filter((i) => i.assignedRole === r);
  const mgrItem = byRole('MANAGER')[0];
  const adminItem = byRole('COMPANY_ADMIN')[0];
  check('HR cannot clear a COMPANY_ADMIN item (403)', (await hr('POST', `/offboarding/${caseId}/clearance/${adminItem.id}/clear`, {})).status === 403);
  check('manager cannot clear an HR item (403)', (await manager('POST', `/offboarding/${caseId}/clearance/${byRole('HR_MANAGER')[0].id}/clear`, {})).status === 403);
  check('manager clears handover', (await manager('POST', `/offboarding/${caseId}/clearance/${mgrItem.id}/clear`, { notes: 'handed over' })).status === 201);
  check('cannot clear the same item twice', (await manager('POST', `/offboarding/${caseId}/clearance/${mgrItem.id}/clear`, {})).status === 400);
  for (const it of byRole('HR_MANAGER')) {
    check(`HR clears "${it.title.slice(0, 30)}"`, (await hr('POST', `/offboarding/${caseId}/clearance/${it.id}/clear`, {})).status === 201);
  }
  check('exit interview blocked until clearance completes', (await hr('POST', `/offboarding/${caseId}/exit-interview`, { primaryReason: 'x', rating: 3, wouldRecommend: true })).status === 400);
  const cleared = await admin('POST', `/offboarding/${caseId}/clearance/${adminItem.id}/clear`, {});
  check('last item cleared -> EXIT_INTERVIEW', cleared.data?.status === 'EXIT_INTERVIEW', cleared);

  console.log('\n-- exit interview + settlement --');
  check('invalid rating rejected by validation', (await hr('POST', `/offboarding/${caseId}/exit-interview`, { primaryReason: 'x', rating: 9, wouldRecommend: true })).status === 400);
  const exit = await hr('POST', `/offboarding/${caseId}/exit-interview`, { primaryReason: 'Better opportunity', feedback: 'Good team', rating: 4, wouldRecommend: true });
  check('exit interview -> SETTLEMENT', exit.data?.status === 'SETTLEMENT', exit);
  const s = exit.data?.settlement;
  check('settlement computed with numeric net', typeof s?.net === 'number' && s.net > 0, s);
  check('settlement flagged as unvalidated draft', s?.validated === false);
  check('settlement pro-rates the final month', s && s.workedDays <= s.daysInMonth, s);

  console.log('\n-- completion --');
  check('HR cannot complete (COMPANY_ADMIN only, 403)', (await hr('POST', `/offboarding/${caseId}/complete`)).status === 403);
  const done = await admin('POST', `/offboarding/${caseId}/complete`);
  check('admin completes -> COMPLETED', done.data?.status === 'COMPLETED', done);
  const emp = await admin('GET', `/employees/${empId}`);
  check('employee record closed (RESIGNED)', emp.data?.status === 'RESIGNED', emp.data?.status);
  check('cannot open a new case for a departed employee', (await hr('POST', '/offboarding', { employeeId: empId, type: 'TERMINATION', lastWorkingDay: lwd })).status === 400);

  console.log('\n-- leave on the shared engine --');
  const balances = (await employee('GET', '/leave/balances')).data as any[];
  const withDays = balances.find((b) => Number(b.entitled) + Number(b.carried) - Number(b.used) - Number(b.pending) >= 1);
  const policy = { id: withDays?.policyId };
  const day = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const req = await employee('POST', '/leave/requests', { policyId: policy.id, startDate: day, endDate: day, reason: 'workflow test' });
  check('employee creates leave request', req.status === 201, req);
  if (req.status === 201) {
    check('employee cannot approve leave (403)', (await employee('PATCH', `/leave/requests/${req.data.id}/approve`)).status === 403);
    const approve = await manager('PATCH', `/leave/requests/${req.data.id}/approve`);
    check('direct manager approves leave via engine', approve.status === 200 && approve.data?.status === 'APPROVED', approve);
    check('double approval is rejected', (await manager('PATCH', `/leave/requests/${req.data.id}/approve`)).status === 400);
    const rej = await manager('PATCH', `/leave/requests/${req.data.id}/reject`, { reason: 'late' });
    check('cannot reject an already-approved request', rej.status === 400, rej);
  }

  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
