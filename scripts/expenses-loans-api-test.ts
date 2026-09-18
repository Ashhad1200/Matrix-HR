/**
 * Phase 6a: expense claims, reimbursements via payroll, loans/advances, and their recovery at exit.
 * Uses payroll period 2035-01 (a period no real run uses; left as a DRAFT) and a throwaway employee.
 * Usage: pnpm test:expenses   (stack running; docker on PATH for two setup/cleanup statements)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { execFileSync } from 'child_process';

config({ path: resolve(__dirname, '../.env') });

const API = `${process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001'}/api/v1`;
let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 240)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
};

async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
  const token = ((await r.json()) as any).accessToken as string;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, text };
  };
  return { call, me: (await call('GET', '/auth/me')).data };
}

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'matrixhr-postgres', 'psql', '-U', 'matrixhr', '-d', 'matrixhr', '-tAc', sql]).toString().trim();

const addMonths = (period: string, n: number) => {
  const [y, m] = period.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const stamp = Date.now();
const thisMonth = today.slice(0, 7);

async function main() {
  console.log(`Expenses & loans test -> ${API}\n`);
  const admin = await login('admin@acme.com');
  const hr = await login('hr@acme.com');
  const manager = await login('ali.khan@acme.com');
  const emp = await login('sara.ahmed@acme.com');
  const globex = await login('admin@globex.com');
  const saraId = emp.me.employeeId;

  // Loans linger by design (an approved loan can't be cancelled), so clear this test's prior state first.
  psql(`delete from "CompensationItem" where "sourceType"='LoanRequest' and "employeeId"='${saraId}'`);
  psql(`delete from "LoanRequest" where "employeeId"='${saraId}'`);

  console.log('-- categories --');
  const travel = (await hr.call('POST', '/expenses/categories', { name: `Travel ${stamp}`, maxAmountPerItem: 50000 })).data;
  const meals = (await hr.call('POST', '/expenses/categories', { name: `Meals ${stamp}`, requiresReceipt: true })).data;
  check('HR creates categories', !!travel.id && !!meals.id, [travel, meals]);
  check('duplicate name refused (409)', (await hr.call('POST', '/expenses/categories', { name: `Travel ${stamp}` })).status === 409);
  check('employees cannot create categories (403)', (await emp.call('POST', '/expenses/categories', { name: 'x' })).status === 403);

  console.log('\n-- claim validation (server is the authority) --');
  const claim = (items: unknown[], extra: object = {}) => emp.call('POST', '/expenses/claims', { title: 'Client visit', items, ...extra });
  const item = (over: object = {}) => ({ categoryId: travel.id, date: daysAgo(3), amount: 12000.5, description: 'Taxi', ...over });
  check('empty items refused (400)', (await claim([])).status === 400);
  check('future-dated item refused (400)', (await claim([item({ date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) })])).status === 400);
  check('item older than 180 days refused (400)', (await claim([item({ date: daysAgo(200) })])).status === 400);
  check('per-item category limit enforced (400)', (await claim([item({ amount: 60000 })])).status === 400);
  check('receipt-required category without a receipt (400)', (await claim([item({ categoryId: meals.id })])).status === 400);
  check('unknown category refused (400)', (await claim([item({ categoryId: 'nope' })])).status === 400);
  check('a client-supplied total is rejected, not trusted (400)', (await claim([item()], { totalAmount: 1 })).status === 400);
  check('a javascript: receipt URL is rejected (400)', (await claim([item({ categoryId: meals.id, receiptUrl: 'javascript:alert(1)' })])).status === 400);
  check('another tenant\'s category is unusable (400)', (await claim([item({ categoryId: ((await globex.call('POST', '/expenses/categories', { name: `G ${stamp}` })).data ?? {}).id ?? 'x' })])).status === 400);

  console.log('\n-- claim lifecycle + approval chain --');
  const c1 = (await claim([item(), item({ amount: 3000, description: 'Parking' })])).data;
  check('valid claim created as DRAFT with a server-computed total', c1.status === 'DRAFT' && Number(c1.totalAmount) === 15000.5, c1);
  check('editing a draft works', (await emp.call('PATCH', `/expenses/claims/${c1.id}`, { title: 'Client visit (edited)' })).data.title === 'Client visit (edited)');
  check('a manager cannot submit someone else\'s claim (403)', (await manager.call('POST', `/expenses/claims/${c1.id}/submit`)).status === 403);
  const submitted = await emp.call('POST', `/expenses/claims/${c1.id}/submit`);
  check('submit -> SUBMITTED, waiting for the manager', submitted.data.status === 'SUBMITTED' && submitted.data.approvals?.awaitingRole === 'MANAGER', submitted.data);
  check('a submitted claim can no longer be edited (400)', (await emp.call('PATCH', `/expenses/claims/${c1.id}`, { title: 'x' })).status === 400);
  check('employees cannot decide (403)', (await emp.call('POST', `/expenses/claims/${c1.id}/decision`, { action: 'APPROVE' })).status === 403);
  check('employees have no approvals inbox (403)', (await emp.call('GET', '/expenses/inbox')).status === 403);
  check('the direct manager sees it in their inbox', ((await manager.call('GET', '/expenses/inbox')).data as any[]).some((x) => x.id === c1.id));
  check('another tenant cannot read the claim', (await globex.call('GET', `/expenses/claims/${c1.id}`)).status === 404);
  const s0 = await manager.call('POST', `/expenses/claims/${c1.id}/decision`, { action: 'APPROVE' });
  check('manager approves step 1; HR is next', s0.data.status === 'SUBMITTED' && s0.data.approvals?.awaitingRole === 'HR_MANAGER', s0.data);
  const s1 = await hr.call('POST', `/expenses/claims/${c1.id}/decision`, { action: 'APPROVE' });
  check('HR approves step 2 -> APPROVED', s1.data.status === 'APPROVED', s1.data);
  check('an approved claim cannot be decided again (400)', (await hr.call('POST', `/expenses/claims/${c1.id}/decision`, { action: 'REJECT' })).status === 400);

  const c2 = (await claim([item({ amount: 500 })])).data;
  await emp.call('POST', `/expenses/claims/${c2.id}/submit`);
  const rej = await manager.call('POST', `/expenses/claims/${c2.id}/decision`, { action: 'REJECT', comment: 'Not a business expense' });
  check('a rejection is final and records the reason', rej.data.status === 'REJECTED' && /Not a business/.test(rej.data.decisionNote ?? ''), rej.data);
  const c3 = (await claim([item({ amount: 700 })])).data;
  await emp.call('POST', `/expenses/claims/${c3.id}/submit`);
  const cancelled = await emp.call('POST', `/expenses/claims/${c3.id}/cancel`);
  check('the owner can withdraw a pending claim', cancelled.data.status === 'CANCELLED');

  console.log('\n-- reimbursement flows into payroll (period 2035-01) --');
  const P = '2035-01';
  let run = ((await hr.call('GET', '/payroll/runs')).data as any[]).find((r) => r.period === P);
  if (!run) run = (await hr.call('POST', `/payroll/runs?period=${P}`)).data.run;
  else if (run.status === 'DRAFT') await hr.call('POST', `/payroll/runs/${run.id}/recalculate`);
  const runId = run.id;
  check('a malformed period is refused (400)', (await hr.call('POST', '/payroll/runs?period=not-a-period')).status === 400);
  const itemFor = async () => ((await hr.call('GET', `/payroll/runs/${runId}`)).data.items as any[]).find((i) => i.employeeId === saraId);
  let line = await itemFor();
  const reimb = Number(line.breakdown?.reimbursements);
  check('the approved claim is paid with the run (reimbursements >= 15000.50)', reimb >= 15000.5 && line.breakdown.reimbursedClaimIds.includes(c1.id), line.breakdown);
  check('reimbursements sit on top of net and are not taxed or part of gross', Math.abs(Number(line.netSalary) - (Number(line.grossSalary) - Number(line.deductions) + reimb)) < 0.01);
  check('the claim stays APPROVED while the run is only a draft', (await emp.call('GET', `/expenses/claims/${c1.id}`)).data.status === 'APPROVED');
  check('rejected/cancelled claims are not paid', !line.breakdown.reimbursedClaimIds.includes(c2.id) && !line.breakdown.reimbursedClaimIds.includes(c3.id));

  await hr.call('POST', `/payroll/runs/${runId}/submit`);
  await admin.call('POST', `/payroll/runs/${runId}/approve`);
  const locked = await admin.call('POST', `/payroll/runs/${runId}/lock`);
  check('the run locks', locked.status === 201 && locked.data.status === 'LOCKED', locked.data);
  const paid = (await emp.call('GET', `/expenses/claims/${c1.id}`)).data;
  check('locking marks exactly the included claims REIMBURSED for that period', paid.status === 'REIMBURSED' && paid.reimbursedInPeriod === P, paid);
  const reopened = await admin.call('POST', `/payroll/runs/${runId}/reopen`, { reason: 'test cleanup' });
  check('reopening a run puts the claim back to APPROVED', reopened.status === 201 && (await emp.call('GET', `/expenses/claims/${c1.id}`)).data.status === 'APPROVED');
  check('a draft run can be recalculated', (await hr.call('POST', `/payroll/runs/${runId}/recalculate`)).status === 201);
  check('only HR/admin can recalculate (403)', (await emp.call('POST', `/payroll/runs/${runId}/recalculate`)).status === 403);

  console.log('\n-- loans and advances --');
  const loan = (b: object) => emp.call('POST', '/loans', b);
  const first = addMonths(thisMonth, 1);
  check('an advance above 1x salary is refused (400)', (await loan({ type: 'ADVANCE', amount: 500000, firstDeductionPeriod: first })).status === 400);
  check('a loan above 6x salary is refused (400)', (await loan({ type: 'LOAN', amount: 5_000_000, installments: 36, firstDeductionPeriod: first })).status === 400);
  check('a one-instalment loan is refused (400)', (await loan({ type: 'LOAN', amount: 50000, installments: 1, firstDeductionPeriod: first })).status === 400);
  check('an instalment above half of salary is refused (400)', (await loan({ type: 'LOAN', amount: 400000, installments: 2, firstDeductionPeriod: first })).status === 400);
  check('a past first-deduction period is refused (400)', (await loan({ type: 'LOAN', amount: 60000, installments: 3, firstDeductionPeriod: addMonths(thisMonth, -2) })).status === 400);
  check('a malformed period is refused (400)', (await loan({ type: 'LOAN', amount: 60000, installments: 3, firstDeductionPeriod: '2026-13' })).status === 400);
  const l1 = (await loan({ type: 'LOAN', amount: 60000, installments: 3, firstDeductionPeriod: first, reason: 'test' })).data;
  check('a valid loan request is PENDING', l1.status === 'PENDING', l1);
  check('a second open loan is refused (400)', (await loan({ type: 'LOAN', amount: 30000, installments: 3, firstDeductionPeriod: first })).status === 400);
  check('the requester withdraws it', (await emp.call('POST', `/loans/${l1.id}/cancel`)).data.status === 'CANCELLED');
  const l2 = (await loan({ type: 'LOAN', amount: 60000, installments: 3, firstDeductionPeriod: first })).data;
  check('employees cannot approve loans (403)', (await emp.call('POST', `/loans/${l2.id}/decision`, { action: 'APPROVE' })).status === 403);
  check('managers cannot approve loans (403)', (await manager.call('POST', `/loans/${l2.id}/decision`, { action: 'APPROVE' })).status === 403);
  check('another tenant cannot read it', (await globex.call('GET', `/loans/${l2.id}`)).status === 404);
  const a1 = await hr.call('POST', `/loans/${l2.id}/decision`, { action: 'APPROVE' });
  check('HR approves step 1; the admin is next', a1.data.status === 'PENDING' && a1.data.approvals?.awaitingRole === 'COMPANY_ADMIN', a1.data);
  const a2 = await admin.call('POST', `/loans/${l2.id}/decision`, { action: 'APPROVE' });
  check('admin approves -> APPROVED with an exact schedule', a2.data.status === 'APPROVED' && a2.data.schedule.length === 3 && Math.abs(a2.data.schedule.reduce((s: number, r: any) => s + r.amount, 0) - 60000) < 0.005, a2.data);
  check('outstanding balance is the full amount before any deduction', a2.data.outstanding === 60000);
  const gen = ((await hr.call('GET', `/payroll/compensation-items?employeeId=${saraId}`)).data as any[]).filter((i) => i.sourceId === l2.id);
  check('payroll sees three deduction rows tied to the loan', gen.length === 3 && gen.every((g) => g.type === 'LOAN' && g.recurring === false));
  check('those rows cannot be deleted by hand (400)', (await hr.call('DELETE', `/payroll/compensation-items/${gen[0].id}`)).status === 400);
  check('an approved loan cannot be cancelled (400)', (await emp.call('POST', `/loans/${l2.id}/cancel`)).status === 400);
  const mLoan = (await manager.call('GET', `/loans/${l2.id}`)).data;
  check('the requester\'s manager can view it but not their salary', mLoan.id === l2.id && mLoan.employee.baseSalary === undefined);

  console.log('\n-- leaving with an open loan and an unpaid claim --');
  const code = `LV${String(stamp).slice(-8)}`;
  const leaver = (await admin.call('POST', '/employees', { employeeCode: code, firstName: 'Leaver', lastName: 'Loan', baseSalary: 100000, managerId: manager.me.employeeId, dateOfJoining: '2024-01-01' })).data;
  psql(`insert into "User" (id, "tenantId", "employeeId", email, "passwordHash", role, status, "emailVerified", "updatedAt")
        select 'usr' || md5(random()::text), "tenantId", '${leaver.id}', 'leaver${stamp}@acme.com', "passwordHash", 'EMPLOYEE', 'ACTIVE', true, now()
        from "User" where email='sara.ahmed@acme.com'`);
  const lv = await login(`leaver${stamp}@acme.com`);
  const lLoan = (await lv.call('POST', '/loans', { type: 'LOAN', amount: 60000, installments: 3, firstDeductionPeriod: first })).data;
  await hr.call('POST', `/loans/${lLoan.id}/decision`, { action: 'APPROVE' });
  await admin.call('POST', `/loans/${lLoan.id}/decision`, { action: 'APPROVE' });
  const lClaim = (await lv.call('POST', '/expenses/claims', { title: 'Last trip', items: [{ categoryId: travel.id, date: daysAgo(2), amount: 4000, description: 'Fuel' }] })).data;
  await lv.call('POST', `/expenses/claims/${lClaim.id}/submit`);
  await manager.call('POST', `/expenses/claims/${lClaim.id}/decision`, { action: 'APPROVE' });
  await hr.call('POST', `/expenses/claims/${lClaim.id}/decision`, { action: 'APPROVE' });

  const oc = (await hr.call('POST', '/offboarding', { employeeId: leaver.id, type: 'TERMINATION', lastWorkingDay: today, reason: 'test' })).data;
  await admin.call('POST', `/offboarding/${oc.id}/decision`, { action: 'APPROVE' });
  const cleared = (await admin.call('GET', `/offboarding/${oc.id}`)).data;
  const who: Record<string, any> = { MANAGER: manager, HR_MANAGER: hr, COMPANY_ADMIN: admin };
  for (const it of cleared.clearanceItems) await who[it.assignedRole].call('POST', `/offboarding/${oc.id}/clearance/${it.id}/clear`, {});
  const settled = await hr.call('POST', `/offboarding/${oc.id}/exit-interview`, { primaryReason: 'Test', rating: 3, wouldRecommend: false });
  const st = settled.data.settlement;
  check('the settlement recovers all three unpaid instalments', st?.loanRecovery === 60000, st);
  check('...and pays the approved, unreimbursed claim', st?.reimbursements === 4000, st);
  check('...and says so in its notes', (st?.notes ?? []).some((n: string) => /loan\/advance instalments/.test(n)));
  const done = await admin.call('POST', `/offboarding/${oc.id}/complete`);
  check('completion succeeds', done.data.status === 'COMPLETED', done.data);
  const left = ((await hr.call('GET', `/payroll/compensation-items?employeeId=${leaver.id}`)).data as any[]).filter((i) => i.sourceId === lLoan.id);
  check('future instalments are removed so payroll never deducts them twice', left.length === 0, left);
  check('the loan is closed out', (await hr.call('GET', `/loans/${lLoan.id}`)).data.status === 'COMPLETED');
  const lc = (await hr.call('GET', `/expenses/claims/${lClaim.id}`)).data;
  check('the claim is marked paid via the settlement', lc.status === 'REIMBURSED' && /^settlement:/.test(lc.reimbursedInPeriod), lc);

  // Approved claims would otherwise be paid out in the next REAL payroll run — remove this test's footprint.
  psql(`update "ExpenseClaim" set status='CANCELLED' where id in ('${c1.id}') and status='APPROVED'`);
  psql(`delete from "CompensationItem" where "sourceType"='LoanRequest' and "employeeId"='${saraId}'`);
  psql(`update "LoanRequest" set status='CANCELLED' where "employeeId"='${saraId}' and status='APPROVED'`);

  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
