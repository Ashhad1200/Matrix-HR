import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException, forwardRef, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@matrixhr/database';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WorkflowEngineService, WorkflowActor } from '../workflows/workflow-engine.service';
import { Viewer, scopedEmployeeIds, employeeIdFilter, assertInTenant } from '../common/data-scope';
import { AuditService } from '../audit/audit.service';
import { ensureBalances } from '../common/leave-balances';
import { countWorkingDays, weekendDaysOf } from '../common/working-days';
import { UpdateLeaveRequestDto, CreateLeaveRequestDto, CreateLeavePolicyDto, UpdateLeavePolicyDto, CreateHolidayDto, UpdateHolidayDto } from './dto';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class LeaveService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    @Inject(forwardRef(() => WhatsAppService)) private whatsapp: WhatsAppService,
    private workflow: WorkflowEngineService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    this.workflow.registerHandler('LeaveRequest', {
      onApproved: (instance) => this.applyDecision(instance, 'APPROVED'),
      onRejected: (instance, reason) => this.applyDecision(instance, 'REJECTED', reason),
    });
  }

  /** Preview for the apply form: how many days a request would take, and the company's weekend. */
  async previewDays(tenantId: string, startDate: string, endDate: string) {
    const start = new Date(startDate); const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Dates must look like 2026-03-01');
    return { days: await countWorkingDays(this.prisma, tenantId, start, end), weekendDays: await weekendDaysOf(this.prisma, tenantId) };
  }

  async getWeekend(tenantId: string) { return { weekendDays: await weekendDaysOf(this.prisma, tenantId) }; }

  async setWeekend(tenantId: string, userId: string, days: number[]) {
    const unique = Array.from(new Set(days));
    if (unique.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new BadRequestException('Weekend days are numbers 0 (Sunday) to 6 (Saturday)');
    if (unique.length > 6) throw new BadRequestException('At least one day of the week must be a working day');
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { weekendDays: unique } });
    await this.audit.log({ tenantId, userId, action: 'LEAVE_WEEKEND_SET', entity: 'Tenant', entityId: tenantId, after: { weekendDays: unique } });
    return { weekendDays: unique };
  }

  async getPolicies(tenantId: string) {
    return this.prisma.leavePolicy.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBalances(tenantId: string, employeeId: string | null | undefined) {
    if (!employeeId) {
      return [];
    }
    const year = new Date().getFullYear();
    // Balances are created on demand, so an employee (or a policy added later) never shows an empty list.
    await ensureBalances(this.prisma, tenantId, year, [employeeId]);
    return this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year },
      include: { policy: true },
    });
  }

  async getRequests(tenantId: string, filters: { employeeId?: string; status?: string } | undefined, viewer: Viewer) {
    // Employees see their own requests, managers their reports', HR everyone's.
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        ...employeeIdFilter(allowed, filters?.employeeId),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        policy: true,
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(tenantId: string, employeeId: string, dto: CreateLeaveRequestDto, requestedByUserId?: string) {
    await assertInTenant(this.prisma, tenantId, [{ model: 'leavePolicy', id: dto.policyId, label: 'leave type' }]);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('End date must be after start date');

    // Working days only: weekends (set per company, default Saturday + Sunday) and public holidays are not deducted.
    const workingDays = await countWorkingDays(this.prisma, tenantId, start, end);
    if (workingDays === 0) throw new BadRequestException('Those dates are all weekends or public holidays, so there is nothing to take off your balance');
    const days = dto.isHalfDay ? 0.5 : workingDays;

    // Make sure the balance exists first, otherwise the limit below would silently not apply.
    const year = start.getFullYear();
    const thisYear = new Date().getFullYear();
    if (year >= thisYear - 1 && year <= thisYear + 1) await ensureBalances(this.prisma, tenantId, year, [employeeId], [dto.policyId]);
    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId, policyId: dto.policyId, year },
    });

    if (balance) {
      const available = Number(balance.entitled) + Number(balance.carried) - Number(balance.used) - Number(balance.pending);
      if (days > available) throw new BadRequestException(`Insufficient leave balance. Available: ${available} days`);
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { manager: true },
    });

    const request = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId,
        policyId: dto.policyId,
        startDate: start,
        endDate: end,
        isHalfDay: dto.isHalfDay || false,
        halfDayPeriod: dto.halfDayPeriod,
        days,
        reason: dto.reason,
        approverId: employee?.managerId,
        status: 'PENDING',
      },
      include: { policy: true, employee: true },
    });

    if (balance) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { increment: days } },
      });
    }

    await this.workflow.start({
      tenantId,
      trigger: 'leave.request',
      entityType: 'LeaveRequest',
      entityId: request.id,
      requestedByUserId,
      subjectEmployeeId: employeeId,
    });

    if (employee?.manager) {
      const managerUser = await this.prisma.user.findFirst({
        where: { employeeId: employee.managerId! },
      });
      if (managerUser) {
        await this.notifications.create(
          tenantId, managerUser.id,
          'Leave Request',
          `${employee.firstName} ${employee.lastName} requested ${days} day(s) ${request.policy.name}`,
        );
        if (employee.manager.phone) {
          await this.whatsapp.sendLeaveApprovalRequest(
            tenantId, managerUser.id, employee.manager.phone,
            `${employee.firstName} ${employee.lastName}`, days, request.policy.name, request.id,
          );
        }
      }
    }

    return request;
  }

  /** A request the caller may change: their own (HR/admin may cancel anyone's); only while PENDING. */
  private async ownPending(tenantId: string, id: string, viewer: Viewer, allowHr: boolean) {
    const r = await this.prisma.leaveRequest.findFirst({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Leave request not found');
    const own = !!viewer.employeeId && r.employeeId === viewer.employeeId;
    if (!own && !(allowHr && ['HR_MANAGER', 'COMPANY_ADMIN'].includes(viewer.role))) throw new ForbiddenException('You can only change your own leave requests');
    if (r.status !== 'PENDING') throw new BadRequestException(`This request is already ${r.status.toLowerCase()} and can no longer be changed`);
    return r;
  }

  private async balanceFor(db: Prisma.TransactionClient | PrismaService, employeeId: string, policyId: string, year: number) {
    return db.leaveBalance.findFirst({ where: { employeeId, policyId, year } });
  }

  /** Cancel a pending request: the days go back to the balance and the approval chain is closed. */
  async cancelRequest(tenantId: string, viewer: Viewer, id: string) {
    const r = await this.ownPending(tenantId, id, viewer, true);
    await this.prisma.$transaction(async (tx) => {
      // Claim the status flip first so two simultaneous cancels (or a cancel racing an approval) release the days once.
      const flipped = await tx.leaveRequest.updateMany({ where: { id, tenantId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      if (flipped.count !== 1) throw new BadRequestException('This request was just decided and can no longer be cancelled');
      const bal = await this.balanceFor(tx, r.employeeId, r.policyId, r.startDate.getFullYear());
      if (bal) await tx.leaveBalance.update({ where: { id: bal.id }, data: { pending: { decrement: Number(r.days) } } });
      await tx.workflowInstance.updateMany({ where: { tenantId, entityType: 'LeaveRequest', entityId: id, status: 'pending' }, data: { status: 'cancelled', completedAt: new Date() } });
    });
    await this.audit.log({ tenantId, userId: viewer.userId, action: 'CANCEL', entity: 'LeaveRequest', entityId: id });
    return this.prisma.leaveRequest.findUnique({ where: { id }, include: { policy: true } });
  }

  /** Edit a pending request (owner only). The balance is re-checked against the new dates; the approval chain is unchanged. */
  async updateRequest(tenantId: string, viewer: Viewer, id: string, dto: UpdateLeaveRequestDto) {
    const r = await this.ownPending(tenantId, id, viewer, false);
    const policyId = dto.policyId ?? r.policyId;
    await assertInTenant(this.prisma, tenantId, [{ model: 'leavePolicy', id: policyId, label: 'leave type' }]);
    const start = dto.startDate ? new Date(dto.startDate) : r.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : r.endDate;
    const isHalfDay = dto.isHalfDay ?? r.isHalfDay;
    const workingDays = await countWorkingDays(this.prisma, tenantId, start, end);
    if (workingDays === 0) throw new BadRequestException('Those dates are all weekends or public holidays, so there is nothing to take off your balance');
    const days = isHalfDay ? 0.5 : workingDays;
    const oldYear = r.startDate.getFullYear(); const newYear = start.getFullYear();
    return this.prisma.$transaction(async (tx) => {
      const now = new Date().getFullYear();
      if (newYear >= now - 1 && newYear <= now + 1) await ensureBalances(tx as any, tenantId, newYear, [r.employeeId], [policyId]);
      const oldBal = await this.balanceFor(tx, r.employeeId, r.policyId, oldYear);
      const newBal = await this.balanceFor(tx, r.employeeId, policyId, newYear);
      if (newBal) {
        // available for the new request = what is free once THIS request's own pending days are released
        const releasing = oldBal && oldBal.id === newBal.id ? Number(r.days) : 0;
        const available = Number(newBal.entitled) + Number(newBal.carried) - Number(newBal.used) - Number(newBal.pending) + releasing;
        if (days > available) throw new BadRequestException(`Insufficient leave balance. Available: ${available} days`);
      }
      if (oldBal) await tx.leaveBalance.update({ where: { id: oldBal.id }, data: { pending: { decrement: Number(r.days) } } });
      if (newBal) await tx.leaveBalance.update({ where: { id: newBal.id }, data: { pending: { increment: days } } });
      const moved = await tx.leaveRequest.updateMany({
        where: { id, tenantId, status: 'PENDING' },
        data: { policyId, startDate: start, endDate: end, isHalfDay, halfDayPeriod: isHalfDay ? (dto.halfDayPeriod ?? r.halfDayPeriod) : null, days, ...(dto.reason !== undefined ? { reason: dto.reason } : {}) },
      });
      if (moved.count !== 1) throw new BadRequestException('This request was just decided and can no longer be changed');
      return tx.leaveRequest.findUnique({ where: { id }, include: { policy: true } });
    });
  }

  private async instanceFor(tenantId: string, requestId: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') throw new BadRequestException(`Leave request is already ${request.status.toLowerCase()}`);

    const existing = await this.workflow.findByEntity(tenantId, 'LeaveRequest', requestId);
    if (existing && existing.status === 'pending') return existing;

    // Requests created before the workflow engine existed have no instance yet.
    const requester = await this.prisma.user.findFirst({ where: { employeeId: request.employeeId } });
    return this.workflow.start({
      tenantId,
      trigger: 'leave.request',
      entityType: 'LeaveRequest',
      entityId: requestId,
      requestedByUserId: requester?.id,
      subjectEmployeeId: request.employeeId,
    });
  }

  async approveRequest(tenantId: string, requestId: string, actor: WorkflowActor) {
    const instance = await this.instanceFor(tenantId, requestId);
    await this.workflow.act(tenantId, instance.id, actor, 'APPROVE');
    return this.prisma.leaveRequest.findUnique({ where: { id: requestId } });
  }

  async rejectRequest(tenantId: string, requestId: string, actor: WorkflowActor, reason?: string) {
    const instance = await this.instanceFor(tenantId, requestId);
    await this.workflow.act(tenantId, instance.id, actor, 'REJECT', reason);
    return this.prisma.leaveRequest.findUnique({ where: { id: requestId } });
  }

  // Runs when the shared workflow engine reaches a final decision.
  private async applyDecision(
    instance: { tenantId: string; entityId: string; actions: { actorUserId: string }[] },
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: instance.entityId, tenantId: instance.tenantId },
      include: { policy: true },
    });
    if (!request) return;

    const lastActor = instance.actions[instance.actions.length - 1]?.actorUserId;
    const approver = lastActor ? await this.prisma.user.findUnique({ where: { id: lastActor } }) : null;

    await this.prisma.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: decision,
        approverId: approver?.employeeId ?? undefined,
        ...(decision === 'APPROVED' ? { approvedAt: new Date() } : { rejectionReason: reason }),
      },
    });

    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId: request.employeeId, policyId: request.policyId, year: request.startDate.getFullYear() },
    });
    if (balance) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pending: { decrement: Number(request.days) },
          ...(decision === 'APPROVED' ? { used: { increment: Number(request.days) } } : {}),
        },
      });
    }

    if (decision === 'APPROVED') {
      const empUser = await this.prisma.user.findFirst({ where: { employeeId: request.employeeId } });
      if (empUser) {
        await this.notifications.create(
          instance.tenantId, empUser.id, 'Leave Approved',
          `Your ${request.policy.name} request has been approved.`,
        );
      }
    }
  }

  async getWhosOut(tenantId: string, month?: string) {
    const start = month ? new Date(`${month}-01`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        id: true, startDate: true, endDate: true, days: true, isHalfDay: true, halfDayPeriod: true, status: true,
        employee: { select: { id: true, firstName: true, lastName: true, department: { select: { id: true, name: true } } } },
        policy: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getHolidays(tenantId: string, year?: number) {
    const y = year || new Date().getFullYear();
    return this.prisma.holiday.findMany({
      where: {
        tenantId,
        date: {
          gte: new Date(`${y}-01-01`),
          lte: new Date(`${y}-12-31`),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  // ── Leave setup (HR / admin) ─────────────────────────────────────────────────────────────────────
  async listAllPolicies(tenantId: string) {
    return this.prisma.leavePolicy.findMany({ where: { tenantId }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  async createPolicy(tenantId: string, userId: string, dto: CreateLeavePolicyDto) {
    const dup = await this.prisma.leavePolicy.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
    if (dup) throw new ConflictException('A leave type with that code already exists');
    const policy = await this.prisma.leavePolicy.create({
      data: {
        tenantId, name: dto.name, code: dto.code, daysPerYear: dto.daysPerYear, accrualType: dto.accrualType ?? 'yearly',
        carryForwardMax: dto.carryForwardMax, allowHalfDay: dto.allowHalfDay ?? true, allowNegative: dto.allowNegative ?? false,
        genderRestriction: dto.genderRestriction, eligibilityMonths: dto.eligibilityMonths ?? 0,
      },
    });
    // Everyone who is already employed gets their balance for this leave type straight away.
    const created = await ensureBalances(this.prisma, tenantId, new Date().getFullYear(), undefined, [policy.id]);
    await this.audit.log({ tenantId, userId, action: 'CREATE', entity: 'LeavePolicy', entityId: policy.id, after: { ...dto, balancesCreated: created } });
    return { ...policy, balancesCreated: created };
  }

  async updatePolicy(tenantId: string, userId: string, id: string, dto: UpdateLeavePolicyDto) {
    const before = await this.prisma.leavePolicy.findFirst({ where: { id, tenantId } });
    if (!before) throw new NotFoundException('Leave type not found');
    const policy = await this.prisma.leavePolicy.update({ where: { id }, data: dto as any });
    const year = new Date().getFullYear();
    let adjusted = 0;
    if (dto.daysPerYear != null && dto.daysPerYear !== Number(before.daysPerYear)) {
      // A changed yearly entitlement applies to this year's balances too; what people already used is untouched.
      adjusted = (await this.prisma.leaveBalance.updateMany({ where: { tenantId, policyId: id, year }, data: { entitled: dto.daysPerYear } })).count;
    }
    if (dto.isActive === true && !before.isActive) await ensureBalances(this.prisma, tenantId, year, undefined, [id]);
    await this.audit.log({ tenantId, userId, action: 'UPDATE', entity: 'LeavePolicy', entityId: id, before: { daysPerYear: Number(before.daysPerYear), carryForwardMax: before.carryForwardMax == null ? null : Number(before.carryForwardMax), isActive: before.isActive }, after: { ...dto, balancesAdjusted: adjusted } });
    return { ...policy, balancesAdjusted: adjusted };
  }

  /** Backfills missing balances for everyone (for example for employees who existed before leave setup). */
  async rebuildBalances(tenantId: string, userId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const created = await ensureBalances(this.prisma, tenantId, y);
    await this.audit.log({ tenantId, userId, action: 'REBUILD', entity: 'LeaveBalance', after: { year: y, created } });
    return { year: y, created };
  }

  async createHoliday(tenantId: string, userId: string, dto: CreateHolidayDto) {
    const date = new Date(dto.date);
    const dup = await this.prisma.holiday.findFirst({ where: { tenantId, date, name: dto.name } });
    if (dup) throw new ConflictException('That holiday is already on the calendar');
    const h = await this.prisma.holiday.create({ data: { tenantId, name: dto.name, date, isOptional: dto.isOptional ?? false, country: dto.country ?? 'PK' } });
    await this.audit.log({ tenantId, userId, action: 'CREATE', entity: 'Holiday', entityId: h.id, after: dto });
    return h;
  }

  async updateHoliday(tenantId: string, userId: string, id: string, dto: UpdateHolidayDto) {
    const found = await this.prisma.holiday.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException('Holiday not found');
    const h = await this.prisma.holiday.update({ where: { id }, data: { ...dto, ...(dto.date ? { date: new Date(dto.date) } : {}) } });
    await this.audit.log({ tenantId, userId, action: 'UPDATE', entity: 'Holiday', entityId: id, before: { name: found.name, date: found.date }, after: dto });
    return h;
  }

  async deleteHoliday(tenantId: string, userId: string, id: string) {
    const found = await this.prisma.holiday.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException('Holiday not found');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.log({ tenantId, userId, action: 'DELETE', entity: 'Holiday', entityId: id, before: { name: found.name, date: found.date } });
    return { deleted: true };
  }
}
