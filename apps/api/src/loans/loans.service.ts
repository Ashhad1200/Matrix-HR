import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { Viewer, isHrPlus, scopedEmployeeIds, employeeIdFilter } from '../common/data-scope';
import { tenantToday } from '../common/tenant-time';
import { addMonths, buildSchedule } from './loans.schedule';
import { CreateLoanDto, LoanDecisionDto } from './dto';

// Company-policy defaults, not statutory limits. Per-tenant configuration is the upgrade path.
const MAX_LOAN_MULTIPLE = 6; // x monthly base salary
const MAX_ADVANCE_MULTIPLE = 1;
const MAX_INSTALMENT_SHARE = 0.5; // one instalment may not exceed half the monthly base salary
const FROZEN_RUN_STATUSES = ['REVIEW', 'APPROVED', 'PROCESSED', 'LOCKED'];


@Injectable()
export class LoansService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private workflow: WorkflowEngineService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    this.workflow.registerHandler('LoanRequest', {
      onApproved: (instance) => this.approved(instance.tenantId, instance.entityId),
      onRejected: (instance) => this.rejected(instance.tenantId, instance.entityId),
    });
  }

  private async notify(tenantId: string, employeeId: string, title: string, body: string) {
    const user = await this.prisma.user.findFirst({ where: { tenantId, employeeId } });
    if (user) await this.notifications.create(tenantId, user.id, title, body);
  }

  /** Deductions can only be added to a payroll run that is still editable, so start at the first open period. */
  private async firstOpenPeriod(tenantId: string, requested: string) {
    for (let i = 0; i < 24; i++) {
      const period = addMonths(requested, i);
      const run = await this.prisma.payrollRun.findUnique({ where: { tenantId_period: { tenantId, period } }, select: { status: true } });
      if (!run || !FROZEN_RUN_STATUSES.includes(run.status)) return period;
    }
    return addMonths(requested, 24);
  }

  private async approved(tenantId: string, loanId: string) {
    const loan = await this.prisma.loanRequest.findFirst({ where: { id: loanId, tenantId } });
    if (!loan || loan.status !== 'PENDING') return;

    const start = await this.firstOpenPeriod(tenantId, loan.firstDeductionPeriod);
    const schedule = buildSchedule(Number(loan.amount), loan.installments, start);
    const label = loan.type === 'LOAN' ? 'Loan' : 'Salary advance';
    await this.prisma.$transaction([
      this.prisma.loanRequest.update({ where: { id: loanId }, data: { status: 'APPROVED', decidedAt: new Date(), firstDeductionPeriod: start } }),
      this.prisma.compensationItem.createMany({
        data: schedule.map((s, i) => ({
          tenantId, employeeId: loan.employeeId, type: loan.type, label: `${label} instalment ${i + 1}/${loan.installments}`,
          amount: s.amount, recurring: false, startPeriod: s.period, sourceType: 'LoanRequest', sourceId: loanId,
        })),
      }),
    ]);
    const shifted = start !== loan.firstDeductionPeriod ? ` (moved to ${start} because earlier payroll is already closed)` : '';
    await this.notify(tenantId, loan.employeeId, `${label} approved`,
      `Your ${label.toLowerCase()} of ${Number(loan.amount)} was approved. Deductions start ${start}${shifted}.`);
  }

  private async rejected(tenantId: string, loanId: string) {
    const loan = await this.prisma.loanRequest.findFirst({ where: { id: loanId, tenantId } });
    if (!loan || loan.status !== 'PENDING') return;
    await this.prisma.loanRequest.update({ where: { id: loanId }, data: { status: 'REJECTED', decidedAt: new Date() } });
    await this.notify(tenantId, loan.employeeId, 'Loan request not approved', 'Your request was not approved.');
  }

  private async currentPeriod(tenantId: string) {
    return (await tenantToday(this.prisma, tenantId)).slice(0, 7);
  }

  private async hasActive(tenantId: string, employeeId: string, type: string) {
    const pending = await this.prisma.loanRequest.count({ where: { tenantId, employeeId, type, status: 'PENDING' } });
    if (pending > 0) return true;
    const approved = await this.prisma.loanRequest.findMany({ where: { tenantId, employeeId, type, status: 'APPROVED' }, select: { id: true } });
    if (!approved.length) return false;
    // "Active" = still has an instalment to come.
    const upcoming = await this.prisma.compensationItem.count({
      where: { tenantId, sourceType: 'LoanRequest', sourceId: { in: approved.map((a) => a.id) }, startPeriod: { gte: await this.currentPeriod(tenantId) } },
    });
    return upcoming > 0;
  }

  async create(tenantId: string, viewer: Viewer, dto: CreateLoanDto) {
    if (!viewer.employeeId) throw new ForbiddenException('No employee profile is linked to this account');
    const emp = await this.prisma.employee.findFirst({ where: { id: viewer.employeeId, tenantId, status: 'ACTIVE' } });
    if (!emp?.baseSalary) throw new BadRequestException('A base salary must be on record before requesting a loan or advance');
    const salary = Number(emp.baseSalary);

    const installments = dto.type === 'ADVANCE' ? 1 : dto.installments ?? 0;
    if (dto.type === 'LOAN' && installments < 2) throw new BadRequestException('A loan needs at least 2 instalments (use an advance for a single deduction)');
    const limit = salary * (dto.type === 'LOAN' ? MAX_LOAN_MULTIPLE : MAX_ADVANCE_MULTIPLE);
    if (dto.amount > limit) {
      throw new BadRequestException(`The maximum ${dto.type === 'LOAN' ? 'loan' : 'advance'} is ${limit} (${dto.type === 'LOAN' ? MAX_LOAN_MULTIPLE : MAX_ADVANCE_MULTIPLE}x monthly salary)`);
    }
    if (dto.amount / installments > salary * MAX_INSTALMENT_SHARE) {
      throw new BadRequestException('Each instalment would exceed half of monthly salary — choose more instalments');
    }
    const now = await this.currentPeriod(tenantId);
    if (dto.firstDeductionPeriod < now || dto.firstDeductionPeriod > addMonths(now, 12)) {
      throw new BadRequestException('First deduction must be between this month and 12 months from now');
    }
    if (await this.hasActive(tenantId, emp.id, dto.type)) {
      throw new BadRequestException(`You already have an open ${dto.type === 'LOAN' ? 'loan' : 'advance'} — it must finish before requesting another`);
    }

    const loan = await this.prisma.loanRequest.create({
      data: { tenantId, employeeId: emp.id, type: dto.type, amount: dto.amount, installments, firstDeductionPeriod: dto.firstDeductionPeriod, reason: dto.reason },
    });
    const instance = await this.workflow.start({
      tenantId, trigger: 'loan.request', entityType: 'LoanRequest', entityId: loan.id,
      requestedByUserId: viewer.userId, subjectEmployeeId: emp.id,
    });
    await this.prisma.loanRequest.update({ where: { id: loan.id }, data: { workflowInstanceId: instance.id } });
    await this.audit.log({ tenantId, userId: viewer.userId, action: 'CREATE', entity: 'LoanRequest', entityId: loan.id, after: { type: dto.type, amount: dto.amount, installments } });
    return this.get(tenantId, viewer, loan.id);
  }

  private include = { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, baseSalary: true, managerId: true } } };

  async list(tenantId: string, viewer: Viewer, filters: { status?: string; employeeId?: string } = {}) {
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    const rows = await this.prisma.loanRequest.findMany({
      where: { tenantId, ...employeeIdFilter(allowed, filters.employeeId), ...(filters.status ? { status: filters.status as any } : {}) },
      include: this.include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Salary is HR's business; a manager viewing a report's loan doesn't need it.
    return isHrPlus(viewer.role) ? rows : rows.map((r) => ({ ...r, employee: { ...r.employee, baseSalary: undefined } }));
  }

  async get(tenantId: string, viewer: Viewer, id: string) {
    const loan = await this.prisma.loanRequest.findFirst({ where: { id, tenantId }, include: this.include });
    if (!loan) throw new NotFoundException('Loan request not found');
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    if (allowed !== null && !allowed.includes(loan.employeeId)) throw new ForbiddenException('You do not have access to this request');

    const items = await this.prisma.compensationItem.findMany({
      where: { tenantId, sourceType: 'LoanRequest', sourceId: id },
      orderBy: { startPeriod: 'asc' },
    });
    const runs = items.length
      ? await this.prisma.payrollRun.findMany({ where: { tenantId, period: { in: items.map((i) => i.startPeriod!) } }, select: { period: true, status: true } })
      : [];
    const settled = new Set(runs.filter((r) => ['APPROVED', 'PROCESSED', 'LOCKED'].includes(r.status)).map((r) => r.period));
    const schedule = items.map((i) => ({ period: i.startPeriod, amount: Number(i.amount), deducted: settled.has(i.startPeriod!) }));
    const instance = loan.workflowInstanceId ? await this.workflow.getInstanceOrThrow(tenantId, loan.workflowInstanceId) : null;

    const out = {
      ...loan,
      schedule,
      outstanding: schedule.filter((s) => !s.deducted).reduce((sum, s) => sum + s.amount, 0),
      approvals: instance && { status: instance.status, awaitingRole: this.workflow.currentStepRole(instance), history: instance.actions },
    };
    return isHrPlus(viewer.role) ? out : { ...out, employee: { ...out.employee, baseSalary: undefined } };
  }

  async inbox(tenantId: string, viewer: Viewer) {
    if (!isHrPlus(viewer.role)) return [];
    return this.prisma.loanRequest.findMany({
      where: { tenantId, status: 'PENDING', ...(viewer.employeeId ? { NOT: { employeeId: viewer.employeeId } } : {}) },
      include: this.include,
      orderBy: { createdAt: 'asc' },
    });
  }

  async decide(tenantId: string, viewer: Viewer, id: string, dto: LoanDecisionDto) {
    const loan = await this.prisma.loanRequest.findFirst({ where: { id, tenantId } });
    if (!loan) throw new NotFoundException('Loan request not found');
    if (loan.status !== 'PENDING' || !loan.workflowInstanceId) throw new BadRequestException('This request is not awaiting a decision');
    await this.workflow.act(tenantId, loan.workflowInstanceId, viewer, dto.action, dto.comment);
    await this.audit.log({ tenantId, userId: viewer.userId, action: dto.action, entity: 'LoanRequest', entityId: id, after: { comment: dto.comment } });
    return this.get(tenantId, viewer, id);
  }

  async cancel(tenantId: string, viewer: Viewer, id: string) {
    const loan = await this.prisma.loanRequest.findFirst({ where: { id, tenantId } });
    if (!loan) throw new NotFoundException('Loan request not found');
    if (loan.employeeId !== viewer.employeeId && !isHrPlus(viewer.role)) throw new ForbiddenException('You cannot cancel this request');
    if (loan.status !== 'PENDING') throw new BadRequestException('Only a pending request can be cancelled — an approved loan is settled through payroll or offboarding');
    await this.prisma.loanRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log({ tenantId, userId: viewer.userId, action: 'CANCEL', entity: 'LoanRequest', entityId: id });
    return this.get(tenantId, viewer, id);
  }
}
