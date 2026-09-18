import { Inject, Injectable, NotFoundException, BadRequestException, forwardRef, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WorkflowEngineService, WorkflowActor } from '../workflows/workflow-engine.service';
import { Viewer, scopedEmployeeIds, employeeIdFilter, assertInTenant } from '../common/data-scope';
import { CreateLeaveRequestDto } from './dto';

@Injectable()
export class LeaveService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    @Inject(forwardRef(() => WhatsAppService)) private whatsapp: WhatsAppService,
    private workflow: WorkflowEngineService,
  ) {}

  onModuleInit() {
    this.workflow.registerHandler('LeaveRequest', {
      onApproved: (instance) => this.applyDecision(instance, 'APPROVED'),
      onRejected: (instance, reason) => this.applyDecision(instance, 'REJECTED', reason),
    });
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

    const days = dto.isHalfDay ? 0.5 : Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId, policyId: dto.policyId, year: start.getFullYear() },
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
            tenantId, employee.manager.phone,
            `${employee.firstName} ${employee.lastName}`, days, request.policy.name, request.id,
          );
        }
      }
    }

    return request;
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
}
