/**
 * Integration tests (real Postgres; RUN_DB_TESTS=1) for the launch blockers: staff invites, leave setup and balances,
 * private signed files, role restrictions, and payroll with empty expense/loan tables.
 */
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailOutboxService, MailService } from '../mail/mail.service';
import { InvitesService } from './invites.service';
import { LeaveService } from '../leave/leave.service';
import { LeaveController } from '../leave/leave.controller';
import { ReportsController } from '../reports/reports.controller';
import { InvitesController } from './invites.controller';
import { EmployeesService } from '../employees/employees.service';
import { FilesService } from '../uploads/files.service';
import { PayrollService } from '../payroll/payroll.service';
import { PkPayrollEngine } from '../payroll/engines/pk-payroll.engine';
import { RecruitmentService } from '../recruitment/recruitment.service';
import { ensureBalances } from '../common/leave-balances';

const run = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const ROLES_KEY = 'roles';

run('launch blockers (database)', () => {
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const mail = new MailService();
  const outbox = new EmailOutboxService(prisma, mail);
  const invites = new InvitesService(prisma, audit, outbox, mail);
  const files = new FilesService({ bucketName: 'matrixhr', publicBase: 'http://localhost:9000' } as any);
  const leave = new LeaveService(prisma, {} as any, {} as any, { start: jest.fn() } as any, audit);
  const employees = new EmployeesService(prisma, audit, { dispatch: jest.fn() } as any, {} as any, { recordUsage: jest.fn() } as any, files);
  const recruitment = new RecruitmentService(prisma, invites);
  const sfx = randomUUID().slice(0, 8);
  const tenants: string[] = [];
  const year = new Date().getFullYear();

  async function mkTenant(name: string) {
    const t = await prisma.tenant.create({ data: { name: `${name}-${sfx}`, subdomain: `${name}-${sfx}` } });
    const admin = await prisma.user.create({ data: { tenantId: t.id, email: `admin@${name}-${sfx}.test`, passwordHash: 'x', role: 'COMPANY_ADMIN' } });
    tenants.push(t.id);
    return { id: t.id, admin: { id: admin.id, role: 'COMPANY_ADMIN' }, hr: { id: admin.id, role: 'HR_MANAGER' } };
  }
  let n = 0;
  const mkEmp = (tenantId: string, over: Record<string, unknown> = {}) =>
    prisma.employee.create({ data: { tenantId, employeeCode: `X${++n}-${sfx}`, firstName: 'Pat', lastName: `Q${n}`, email: `pat${n}-${sfx}@test.example`, status: 'ACTIVE', ...over } as any });

  let A: Awaited<ReturnType<typeof mkTenant>>;
  let B: Awaited<ReturnType<typeof mkTenant>>;

  beforeAll(async () => {
    await prisma.$connect();
    A = await mkTenant('inva');
    B = await mkTenant('invb');
  }, 60_000);

  afterAll(async () => {
    await prisma.emailOutbox.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.payrollItem.deleteMany({ where: { payrollRun: { tenantId: { in: tenants } } } }); // not cascaded by the schema
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
  }, 60_000);

  // ────────────────────────────────────────────────────────────────────────────────────────────────
  describe('staff invitations', () => {
    it('invites an employee, emails a single-use link, and only creates the login once they set a password', async () => {
      const emp = await mkEmp(A.id);
      const inv: any = await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'MANAGER' });
      expect(inv).toMatchObject({ status: 'pending', role: 'MANAGER', email: emp.email });
      expect(await prisma.user.count({ where: { employeeId: emp.id } })).toBe(0); // no account until accepted
      expect(await prisma.emailOutbox.count({ where: { tenantId: A.id, toAddress: emp.email! } })).toBe(1);
      const token = new URL(inv.devLink).searchParams.get('token')!;

      expect(await invites.preview(token)).toMatchObject({ email: emp.email, role: 'MANAGER' });
      await expect(invites.accept(token, 'weakpass')).rejects.toBeInstanceOf(BadRequestException);
      await expect(invites.preview(token)).resolves.toBeDefined(); // a rejected password does not burn the link
    });

    it('creates the linked user with the chosen role and the invitee\'s own password', async () => {
      const emp = await mkEmp(A.id);
      const inv: any = await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'HR_MANAGER' });
      const token = new URL(inv.devLink).searchParams.get('token')!;
      await invites.accept(token, 'Str0ngPass!');
      const u = await prisma.user.findFirstOrThrow({ where: { employeeId: emp.id } });
      expect(u).toMatchObject({ tenantId: A.id, role: 'HR_MANAGER', email: emp.email, emailVerified: true, status: 'ACTIVE' });
      expect(await bcrypt.compare('Str0ngPass!', u.passwordHash)).toBe(true);
      // single use
      await expect(invites.accept(token, 'Another1Pass')).rejects.toBeInstanceOf(BadRequestException);
      await expect(invites.preview(token)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lets exactly one of two simultaneous accepts through', async () => {
      const emp = await mkEmp(A.id);
      const inv: any = await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'EMPLOYEE' });
      const token = new URL(inv.devLink).searchParams.get('token')!;
      const r = await Promise.allSettled([invites.accept(token, 'Str0ngPass!'), invites.accept(token, 'Str0ngPass!')]);
      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.user.count({ where: { employeeId: emp.id } })).toBe(1);
    });

    it('resend kills the old link, revoke kills the new one, and expired links are refused', async () => {
      const emp = await mkEmp(A.id);
      const first: any = await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'EMPLOYEE' });
      const t1 = new URL(first.devLink).searchParams.get('token')!;
      const second: any = await invites.resend(A.id, A.hr, first.id);
      const t2 = new URL(second.devLink).searchParams.get('token')!;
      expect(second.sentCount).toBe(2);
      await expect(invites.preview(t1)).rejects.toBeInstanceOf(BadRequestException);
      await expect(invites.preview(t2)).resolves.toBeDefined();
      await invites.revoke(A.id, A.hr, first.id);
      await expect(invites.accept(t2, 'Str0ngPass!')).rejects.toBeInstanceOf(BadRequestException);
      expect((await invites.people(A.id)).find((p) => p.employeeId === emp.id)?.login).toBe('none');
      // expiry
      const again: any = await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'EMPLOYEE' });
      await prisma.userInvite.update({ where: { id: again.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await expect(invites.accept(new URL(again.devLink).searchParams.get('token')!, 'Str0ngPass!')).rejects.toBeInstanceOf(BadRequestException);
      // only one live invitation per employee
      await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'EMPLOYEE' });
      await invites.create(A.id, A.hr, { employeeId: emp.id, role: 'MANAGER' });
      expect(await prisma.userInvite.count({ where: { employeeId: emp.id, usedAt: null, revokedAt: null } })).toBe(1);
    });

    it('refuses privilege escalation and bad targets', async () => {
      const emp = await mkEmp(A.id);
      await expect(invites.create(A.id, A.hr, { employeeId: emp.id, role: 'COMPANY_ADMIN' })).rejects.toBeInstanceOf(ForbiddenException); // HR cannot mint admins
      await expect(invites.create(A.id, A.admin, { employeeId: emp.id, role: 'COMPANY_ADMIN' })).resolves.toBeDefined(); // an admin can
      expect(Reflect.getMetadata('roles', InvitesController)).toEqual(['HR_MANAGER', 'COMPANY_ADMIN']); // employees/managers cannot call it
      const noEmail = await mkEmp(A.id, { email: null });
      await expect(invites.create(A.id, A.hr, { employeeId: noEmail.id, role: 'EMPLOYEE' })).rejects.toBeInstanceOf(BadRequestException);
      const withLogin = await mkEmp(A.id);
      await prisma.user.create({ data: { tenantId: A.id, employeeId: withLogin.id, email: withLogin.email!, passwordHash: 'x', role: 'EMPLOYEE' } });
      await expect(invites.create(A.id, A.hr, { employeeId: withLogin.id, role: 'EMPLOYEE' })).rejects.toBeInstanceOf(ConflictException);
    });

    it("never touches another company's employees or invitations", async () => {
      const foreign = await mkEmp(B.id);
      await expect(invites.create(A.id, A.hr, { employeeId: foreign.id, role: 'EMPLOYEE' })).rejects.toBeInstanceOf(NotFoundException);
      const mine: any = await invites.create(B.id, B.hr, { employeeId: foreign.id, role: 'EMPLOYEE' });
      await expect(invites.resend(A.id, A.hr, mine.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(invites.revoke(A.id, A.hr, mine.id)).rejects.toBeInstanceOf(NotFoundException);
      expect((await invites.people(A.id)).some((p) => p.employeeId === foreign.id)).toBe(false);
    });

    it('caps admin-level logins per plan, counting pending invitations', async () => {
      const T = await mkTenant('seats');
      const plan = await prisma.plan.upsert({ where: { code: `seats-${sfx}` }, update: {}, create: { code: `seats-${sfx}`, name: 'Seats' } });
      const pv = await prisma.planVersion.create({ data: { planId: plan.id, version: 1, currency: 'USD', priceMonthly: 10, maxAdminUsers: 2 } });
      await prisma.subscription.create({ data: { tenantId: T.id, planVersionId: pv.id, status: 'active' } });
      const [e1, e2, e3] = [await mkEmp(T.id), await mkEmp(T.id), await mkEmp(T.id)];
      await invites.create(T.id, T.admin, { employeeId: e1.id, role: 'HR_MANAGER' }); // existing admin user + this invite = 2
      await expect(invites.create(T.id, T.admin, { employeeId: e2.id, role: 'HR_MANAGER' })).rejects.toThrow(/up to 2 admin users/);
      await expect(invites.create(T.id, T.admin, { employeeId: e3.id, role: 'EMPLOYEE' })).resolves.toBeDefined(); // non-admin roles are unaffected
      await prisma.subscription.delete({ where: { tenantId: T.id } });
      await prisma.planVersion.delete({ where: { id: pv.id } });
      await prisma.plan.delete({ where: { id: plan.id } });
    });

    it('offers an invitation when a candidate is hired, and hiring twice is harmless', async () => {
      const T = await mkTenant('hire');
      const job = await prisma.jobPosting.create({ data: { tenantId: T.id, title: 'Engineer', status: 'OPEN' } as any });
      const app = await prisma.jobApplication.create({ data: { tenantId: T.id, jobId: job.id, firstName: 'Nora', lastName: 'Hire', email: `nora-${sfx}@test.example` } as any });
      const r: any = await recruitment.hireCandidate(T.id, app.id, T.hr, 'EMPLOYEE');
      expect(r.invite).toMatchObject({ status: 'pending', role: 'EMPLOYEE' });
      expect(await prisma.leaveBalance.count({ where: { employeeId: r.id } })).toBe(0); // no leave types defined yet
      const again: any = await recruitment.hireCandidate(T.id, app.id, T.hr);
      expect(again.id).toBe(r.id);
      expect(await prisma.employee.count({ where: { tenantId: T.id, email: `nora-${sfx}@test.example` } })).toBe(1);
      // an existing login is reported, not thrown away with the hire
      await prisma.user.create({ data: { tenantId: T.id, employeeId: r.id, email: `nora-${sfx}@test.example`, passwordHash: 'x', role: 'EMPLOYEE' } });
      const dup: any = await recruitment.hireCandidate(T.id, app.id, T.hr, 'EMPLOYEE');
      expect(dup.inviteError).toMatch(/already has a login/);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────────
  describe('leave setup and balances', () => {
    it('creating a leave type gives every active employee a balance straight away', async () => {
      const T = await mkTenant('leave1');
      const [a, b] = [await mkEmp(T.id), await mkEmp(T.id)];
      const p: any = await leave.createPolicy(T.id, T.hr.id, { name: 'Annual', code: 'annual', daysPerYear: 14, carryForwardMax: 5 } as any);
      expect(p.balancesCreated).toBe(2);
      const bal = await prisma.leaveBalance.findMany({ where: { tenantId: T.id, policyId: p.id } });
      expect(bal.map((x) => x.employeeId).sort()).toEqual([a.id, b.id].sort());
      expect(Number(bal[0].entitled)).toBe(14);
      await expect(leave.createPolicy(T.id, T.hr.id, { name: 'Dup', code: 'annual', daysPerYear: 1 } as any)).rejects.toBeInstanceOf(ConflictException);
    });

    it('a new employee gets balances for existing leave types, and the limit then actually applies', async () => {
      const T = await mkTenant('leave2');
      const p: any = await leave.createPolicy(T.id, T.hr.id, { name: 'Casual', code: 'casual', daysPerYear: 2 } as any);
      const e = await mkEmp(T.id);
      expect(await prisma.leaveBalance.count({ where: { employeeId: e.id } })).toBe(0); // created directly, never through the service
      const mine = await leave.getBalances(T.id, e.id); // lazily created on first look
      expect(mine).toHaveLength(1);
      expect(Number(mine[0].entitled)).toBe(2);
      const d = (s: string) => `${year}-06-${s}`;
      await expect(leave.createRequest(T.id, e.id, { policyId: p.id, startDate: d('01'), endDate: d('05') } as any)).rejects.toThrow(/Insufficient leave balance/);
      // and it is safe under concurrency
      await Promise.all([ensureBalances(prisma, T.id, year), ensureBalances(prisma, T.id, year), ensureBalances(prisma, T.id, year)]);
      expect(await prisma.leaveBalance.count({ where: { employeeId: e.id, policyId: p.id, year } })).toBe(1);
    });

    it('carries forward what is left, up to the policy maximum, into the next year', async () => {
      const T = await mkTenant('carry');
      const p: any = await leave.createPolicy(T.id, T.hr.id, { name: 'Annual', code: 'annual', daysPerYear: 14, carryForwardMax: 5 } as any);
      const e = await mkEmp(T.id);
      const Y = 2040;
      await prisma.leaveBalance.create({ data: { tenantId: T.id, employeeId: e.id, policyId: p.id, year: Y, entitled: 14, used: 8 } }); // 6 left
      await ensureBalances(prisma, T.id, Y + 1, [e.id]);
      const next = await prisma.leaveBalance.findFirstOrThrow({ where: { employeeId: e.id, year: Y + 1 } });
      expect(Number(next.carried)).toBe(5); // capped
      expect(Number(next.entitled)).toBe(14);
      await leave.updatePolicy(T.id, T.hr.id, p.id, { carryForwardMax: null } as any);
    });

    it('skips gender-restricted leave types for everyone else', async () => {
      const T = await mkTenant('gender');
      await leave.createPolicy(T.id, T.hr.id, { name: 'Maternity', code: 'maternity', daysPerYear: 90, genderRestriction: 'female' } as any);
      const [f, m] = [await mkEmp(T.id, { gender: 'Female' }), await mkEmp(T.id, { gender: 'Male' })];
      await ensureBalances(prisma, T.id, year);
      expect(await prisma.leaveBalance.count({ where: { employeeId: f.id } })).toBe(1);
      expect(await prisma.leaveBalance.count({ where: { employeeId: m.id } })).toBe(0);
    });

    it('changing the yearly days updates this year\'s entitlement without touching what was used', async () => {
      const T = await mkTenant('edit');
      const p: any = await leave.createPolicy(T.id, T.hr.id, { name: 'Sick', code: 'sick', daysPerYear: 8 } as any);
      const e = await mkEmp(T.id);
      await ensureBalances(prisma, T.id, year);
      await prisma.leaveBalance.updateMany({ where: { employeeId: e.id, policyId: p.id }, data: { used: 3 } });
      const r: any = await leave.updatePolicy(T.id, T.hr.id, p.id, { daysPerYear: 10 } as any);
      expect(r.balancesAdjusted).toBe(1);
      const bal = await prisma.leaveBalance.findFirstOrThrow({ where: { employeeId: e.id, policyId: p.id } });
      expect([Number(bal.entitled), Number(bal.used)]).toEqual([10, 3]);
      // a deactivated type stops being offered but its history stays
      await leave.updatePolicy(T.id, T.hr.id, p.id, { isActive: false } as any);
      expect((await leave.getPolicies(T.id)).some((x) => x.id === p.id)).toBe(false);
      expect((await leave.listAllPolicies(T.id)).some((x) => x.id === p.id)).toBe(true);
    });

    it('manages holidays, and one company cannot edit or delete another\'s', async () => {
      const T = await mkTenant('hol');
      const U = await mkTenant('hol2');
      const h = await leave.createHoliday(T.id, T.hr.id, { name: 'Eid ul Fitr', date: `${year}-03-31`, isOptional: false } as any);
      await expect(leave.createHoliday(T.id, T.hr.id, { name: 'Eid ul Fitr', date: `${year}-03-31` } as any)).rejects.toBeInstanceOf(ConflictException);
      expect((await leave.updateHoliday(T.id, T.hr.id, h.id, { name: 'Eid ul Fitr (day 1)' })).name).toBe('Eid ul Fitr (day 1)');
      await expect(leave.updateHoliday(U.id, U.hr.id, h.id, { name: 'hacked' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(leave.deleteHoliday(U.id, U.hr.id, h.id)).rejects.toBeInstanceOf(NotFoundException);
      expect((await leave.getHolidays(T.id, year)).map((x) => x.name)).toContain('Eid ul Fitr (day 1)');
      await leave.deleteHoliday(T.id, T.hr.id, h.id);
      expect(await leave.getHolidays(T.id, year)).toHaveLength(0);
    });

    it('limits leave setup to HR and company admins', () => {
      for (const m of ['createPolicy', 'updatePolicy', 'rebuild', 'createHoliday', 'updateHoliday', 'deleteHoliday', 'allPolicies']) {
        expect(Reflect.getMetadata(ROLES_KEY, (LeaveController.prototype as any)[m])).toEqual(['HR_MANAGER', 'COMPANY_ADMIN']);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────────
  describe('private files and restricted reports', () => {
    it('payroll-cost is HR/admin only; managers keep the other reports', () => {
      expect(Reflect.getMetadata(ROLES_KEY, ReportsController.prototype.payrollCost)).toEqual(['HR_MANAGER', 'COMPANY_ADMIN']);
      expect(Reflect.getMetadata(ROLES_KEY, ReportsController)).toContain('MANAGER');
    });

    it('only accepts documents that point at the company\'s own uploaded files', async () => {
      const T = await mkTenant('docs');
      const U = await mkTenant('docs2');
      const e = await mkEmp(T.id);
      const viewer = { id: T.hr.id, role: 'HR_MANAGER', employeeId: undefined } as any;
      await expect(employees.addDocument(T.id, e.id, { type: 'CNIC', name: 'x', fileKey: `${U.id}/theirs.pdf` }, viewer)).rejects.toBeInstanceOf(NotFoundException);
      await expect(employees.addDocument(T.id, e.id, { type: 'CNIC', name: 'x', fileUrl: 'https://evil.example.com/a.pdf' }, viewer)).rejects.toBeInstanceOf(NotFoundException);
      await expect(employees.addDocument(T.id, e.id, { type: 'CNIC', name: 'x' }, viewer)).rejects.toBeInstanceOf(BadRequestException);
      const doc = await employees.addDocument(T.id, e.id, { type: 'CNIC', name: 'cnic.pdf', fileKey: `${T.id}/mine.pdf` }, viewer);
      expect(doc.fileUrl).toBe(`s3:${T.id}/mine.pdf`);
      expect((await employees.getDocumentLink(T.id, e.id, doc.id, viewer)).url).toMatch(/\/api\/v1\/files\//);
      // a colleague (not HR, not the owner) cannot open it, another company cannot even see that it exists
      await expect(employees.getDocumentLink(T.id, e.id, doc.id, { id: 'u', role: 'EMPLOYEE', employeeId: 'someone-else' } as any)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(employees.getDocumentLink(U.id, e.id, doc.id, { id: U.hr.id, role: 'HR_MANAGER' } as any)).rejects.toBeInstanceOf(NotFoundException);
      // the owner can open their own
      await expect(employees.getDocumentLink(T.id, e.id, doc.id, { id: 'me', role: 'EMPLOYEE', employeeId: e.id } as any)).resolves.toBeDefined();
    });

    it("an employee gets signed links to their own payslips only, and the list never exposes the stored file reference", async () => {
      const T = await mkTenant('slips');
      const [me, other] = [await mkEmp(T.id), await mkEmp(T.id)];
      const prun = await prisma.payrollRun.create({ data: { tenantId: T.id, period: '2026-01', status: 'LOCKED' } });
      const mk = (employeeId: string) => prisma.payrollItem.create({ data: { payrollRunId: prun.id, employeeId, grossSalary: 100, deductions: 10, netSalary: 90, payslipUrl: `s3:${T.id}/slip-${employeeId}.pdf` } as any });
      const [mine, theirs] = [await mk(me.id), await mk(other.id)];
      const list: any[] = await employees.getMyPayslips(T.id, me.id);
      expect(list).toHaveLength(1);
      expect(list[0]).not.toHaveProperty('payslipUrl');
      expect(list[0].hasPayslip).toBe(true);
      await expect(employees.getMyPayslipLink(T.id, me.id, mine.id)).resolves.toHaveProperty('url');
      await expect(employees.getMyPayslipLink(T.id, me.id, theirs.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(employees.getMyPayslipLink('some-other-tenant', me.id, mine.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────────
  describe('payroll with nothing in the expense/loan tables', () => {
    it('still calculates a run (empty expenses, loans and compensation items)', async () => {
      const T = await mkTenant('pay');
      await mkEmp(T.id, { baseSalary: 150000 });
      expect(await prisma.expenseClaim.count({ where: { tenantId: T.id } })).toBe(0);
      expect(await prisma.loanRequest.count({ where: { tenantId: T.id } })).toBe(0);
      const payroll = new PayrollService(prisma, { getEngine: async () => new PkPayrollEngine() } as any, {} as any, {} as any, files, {} as any);
      const out: any = await payroll.createPayrollRun(T.id, '2026-09', T.admin.id);
      expect(out.items).toHaveLength(1);
      expect(Number(out.items[0].netSalary)).toBeGreaterThan(0);
      expect(out.summary.totalEmployees).toBe(1);
    });
  });
});
