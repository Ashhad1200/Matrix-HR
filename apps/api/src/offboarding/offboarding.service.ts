import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PayrollService } from '../payroll/payroll.service';
import { WorkflowEngineService, WorkflowActor, roleRank } from '../workflows/workflow-engine.service';
import { tenantToday } from '../common/tenant-time';
import { ClearItemDto, ExitInterviewDto, InitiateOffboardingDto, OffboardingDecisionDto } from './dto';

const OPEN_STATUSES = ['PENDING_APPROVAL', 'CLEARANCE', 'EXIT_INTERVIEW', 'SETTLEMENT'] as const;

const CLEARANCE_TEMPLATE = [
  { title: 'Handover of work and knowledge transfer', department: 'Line Manager', assignedRole: 'MANAGER' },
  { title: 'Return of company assets (laptop, ID card, keys)', department: 'HR', assignedRole: 'HR_MANAGER' },
  { title: 'Loans, advances and dues reconciled', department: 'Finance / HR', assignedRole: 'HR_MANAGER' },
  { title: 'System accounts and email access reviewed', department: 'IT / Admin', assignedRole: 'COMPANY_ADMIN' },
] as const;

type Actor = WorkflowActor;

@Injectable()
export class OffboardingService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private workflow: WorkflowEngineService,
    private payroll: PayrollService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private webhooks: WebhooksService,
  ) {}

  onModuleInit() {
    this.workflow.registerHandler('OffboardingCase', {
      onApproved: async (instance) => {
        const c = await this.prisma.offboardingCase.findFirst({
          where: { id: instance.entityId, tenantId: instance.tenantId },
        });
        // A cancelled case can still have a workflow that later resolves — ignore it.
        if (!c || c.status !== 'PENDING_APPROVAL') return;

        await this.prisma.$transaction([
          this.prisma.offboardingCase.update({ where: { id: c.id }, data: { status: 'CLEARANCE' } }),
          this.prisma.offboardingClearanceItem.createMany({
            data: CLEARANCE_TEMPLATE.map((t, i) => ({ caseId: c.id, sortOrder: i, ...t })),
          }),
        ]);
        await this.notifyEmployee(c.tenantId, c.employeeId, 'Offboarding approved', 'Your exit request was approved. Clearance has started.');
      },
      onRejected: async (instance, reason) => {
        const c = await this.prisma.offboardingCase.findFirst({
          where: { id: instance.entityId, tenantId: instance.tenantId },
        });
        if (!c || c.status !== 'PENDING_APPROVAL') return;
        await this.prisma.offboardingCase.update({ where: { id: c.id }, data: { status: 'REJECTED' } });
        await this.notifyEmployee(c.tenantId, c.employeeId, 'Offboarding not approved', reason || 'Your exit request was not approved.');
      },
    });
  }

  private isHrOrAbove(actor: Actor) {
    return roleRank(actor.role) >= roleRank('HR_MANAGER');
  }

  private async notifyEmployee(tenantId: string, employeeId: string, title: string, body: string) {
    const user = await this.prisma.user.findFirst({ where: { tenantId, employeeId } });
    if (user) await this.notifications.create(tenantId, user.id, title, body);
  }

  private include = {
    employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, managerId: true } },
    clearanceItems: { orderBy: { sortOrder: 'asc' as const } },
  };

  // ── Read ────────────────────────────────────────────────────────────────
  async list(tenantId: string, status?: string) {
    return this.prisma.offboardingCase.findMany({
      where: { tenantId, ...(status ? { status: status as any } : {}) },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMine(tenantId: string, employeeId: string | null | undefined) {
    if (!employeeId) return [];
    return this.prisma.offboardingCase.findMany({
      where: { tenantId, employeeId },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Open cases this actor is responsible for: their reports (manager) or everything open (HR+). */
  async inbox(tenantId: string, actor: Actor) {
    const hrPlus = this.isHrOrAbove(actor);
    if (!hrPlus && !actor.employeeId) return [];
    return this.prisma.offboardingCase.findMany({
      where: {
        tenantId,
        status: { in: [...OPEN_STATUSES] },
        ...(hrPlus ? {} : { employee: { managerId: actor.employeeId! } }),
      },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string, actor: Actor) {
    const c = await this.prisma.offboardingCase.findFirst({ where: { id, tenantId }, include: this.include });
    if (!c) throw new NotFoundException('Offboarding case not found');

    const isSubject = !!actor.employeeId && actor.employeeId === c.employeeId;
    const isSubjectManager = actor.role === 'MANAGER' && !!actor.employeeId && c.employee.managerId === actor.employeeId;
    if (!isSubject && !isSubjectManager && !this.isHrOrAbove(actor)) {
      throw new ForbiddenException('You do not have access to this offboarding case');
    }

    const instance = c.workflowInstanceId
      ? await this.workflow.getInstanceOrThrow(tenantId, c.workflowInstanceId)
      : null;
    return {
      ...c,
      approvals: instance && {
        status: instance.status,
        currentStep: instance.currentStep,
        awaitingRole: this.workflow.currentStepRole(instance),
        history: instance.actions,
      },
    };
  }

  // ── Initiate ────────────────────────────────────────────────────────────
  async initiate(tenantId: string, actor: Actor, dto: InitiateOffboardingDto) {
    const privileged = this.isHrOrAbove(actor);
    let employeeId = actor.employeeId;
    let type = dto.type;
    if (privileged && dto.employeeId) {
      employeeId = dto.employeeId;
    } else if (!privileged) {
      // Non-HR users can only resign on their own behalf.
      type = 'RESIGNATION';
    }
    if (!employeeId) throw new BadRequestException('No employee profile is linked to this account');

    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.status === 'RESIGNED' || employee.status === 'TERMINATED') {
      throw new BadRequestException('Employee has already left the organisation');
    }

    const open = await this.prisma.offboardingCase.findFirst({
      where: { tenantId, employeeId, status: { in: [...OPEN_STATUSES] } },
    });
    if (open) throw new BadRequestException('An offboarding case is already open for this employee');

    const lastWorkingDay = new Date(dto.lastWorkingDay);
    const today = new Date(await tenantToday(this.prisma, tenantId));
    if (!privileged && lastWorkingDay < today) {
      throw new BadRequestException('Last working day cannot be in the past');
    }

    const created = await this.prisma.offboardingCase.create({
      data: {
        tenantId,
        employeeId,
        type,
        reason: dto.reason,
        lastWorkingDay,
        initiatedByUserId: actor.userId,
      },
    });

    const instance = await this.workflow.start({
      tenantId,
      trigger: type === 'RESIGNATION' ? 'offboarding.resignation' : 'offboarding.termination',
      entityType: 'OffboardingCase',
      entityId: created.id,
      requestedByUserId: actor.userId,
      subjectEmployeeId: employeeId,
    });
    await this.prisma.offboardingCase.update({ where: { id: created.id }, data: { workflowInstanceId: instance.id } });

    await this.audit.log({
      tenantId, userId: actor.userId, action: 'CREATE', entity: 'OffboardingCase', entityId: created.id,
      after: { employeeId, type, lastWorkingDay: dto.lastWorkingDay },
    });
    return this.get(tenantId, created.id, actor);
  }

  // ── Approval (via the shared workflow engine) ───────────────────────────
  async decide(tenantId: string, id: string, actor: Actor, dto: OffboardingDecisionDto) {
    const c = await this.prisma.offboardingCase.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Offboarding case not found');
    if (c.status !== 'PENDING_APPROVAL' || !c.workflowInstanceId) {
      throw new BadRequestException('This case is not awaiting approval');
    }
    await this.workflow.act(tenantId, c.workflowInstanceId, actor, dto.action, dto.comment);
    await this.audit.log({
      tenantId, userId: actor.userId, action: dto.action, entity: 'OffboardingCase', entityId: id,
      after: { comment: dto.comment },
    });
    return this.get(tenantId, id, actor);
  }

  // ── Clearance ───────────────────────────────────────────────────────────
  async clearItem(tenantId: string, id: string, itemId: string, actor: Actor, dto: ClearItemDto) {
    const c = await this.prisma.offboardingCase.findFirst({
      where: { id, tenantId },
      include: { employee: { select: { managerId: true } } },
    });
    if (!c) throw new NotFoundException('Offboarding case not found');
    if (c.status !== 'CLEARANCE') throw new BadRequestException('Case is not in the clearance stage');
    if (actor.employeeId && actor.employeeId === c.employeeId) {
      throw new ForbiddenException('You cannot clear your own offboarding items');
    }

    const item = await this.prisma.offboardingClearanceItem.findFirst({ where: { id: itemId, caseId: id } });
    if (!item) throw new NotFoundException('Clearance item not found');
    if (item.status === 'CLEARED') throw new BadRequestException('Item is already cleared');

    if (roleRank(actor.role) < roleRank(item.assignedRole)) {
      throw new ForbiddenException(`This item must be cleared by ${item.assignedRole} or higher`);
    }
    if (actor.role === 'MANAGER' && c.employee.managerId !== actor.employeeId) {
      throw new ForbiddenException("Only the employee's direct manager can clear this item");
    }

    await this.prisma.offboardingClearanceItem.update({
      where: { id: itemId },
      data: { status: 'CLEARED', clearedByUserId: actor.userId, clearedAt: new Date(), notes: dto.notes },
    });

    const remaining = await this.prisma.offboardingClearanceItem.count({ where: { caseId: id, status: 'PENDING' } });
    if (remaining === 0) {
      await this.prisma.offboardingCase.update({ where: { id }, data: { status: 'EXIT_INTERVIEW' } });
    }
    return this.get(tenantId, id, actor);
  }

  // ── Exit interview → draft settlement ───────────────────────────────────
  async submitExitInterview(tenantId: string, id: string, actor: Actor, dto: ExitInterviewDto) {
    const c = await this.prisma.offboardingCase.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Offboarding case not found');
    const isSubject = !!actor.employeeId && actor.employeeId === c.employeeId;
    if (!isSubject && !this.isHrOrAbove(actor)) {
      throw new ForbiddenException('Only the employee or HR can submit the exit interview');
    }
    if (c.status !== 'EXIT_INTERVIEW') throw new BadRequestException('Case is not at the exit interview stage');

    const settlement = await this.payroll.calculateFinalSettlement(tenantId, c.employeeId, c.lastWorkingDay);
    await this.prisma.offboardingCase.update({
      where: { id },
      data: { exitInterview: dto as any, exitInterviewAt: new Date(), settlement: settlement as any, status: 'SETTLEMENT' },
    });
    return this.get(tenantId, id, actor);
  }

  async recalculateSettlement(tenantId: string, id: string, actor: Actor) {
    const c = await this.prisma.offboardingCase.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Offboarding case not found');
    if (c.status !== 'SETTLEMENT') throw new BadRequestException('Case is not at the settlement stage');
    const settlement = await this.payroll.calculateFinalSettlement(tenantId, c.employeeId, c.lastWorkingDay);
    await this.prisma.offboardingCase.update({ where: { id }, data: { settlement: settlement as any } });
    return this.get(tenantId, id, actor);
  }

  // ── Completion: sign-off, close the employee record, remove access ──────
  async complete(tenantId: string, id: string, actor: Actor) {
    const c = await this.prisma.offboardingCase.findFirst({ where: { id, tenantId }, include: { employee: true } });
    if (!c) throw new NotFoundException('Offboarding case not found');
    if (c.status !== 'SETTLEMENT') throw new BadRequestException('Case is not ready for completion');
    if (actor.employeeId && actor.employeeId === c.employeeId) {
      throw new ForbiddenException('You cannot sign off your own final settlement');
    }
    if (c.initiatedByUserId === actor.userId) {
      throw new ForbiddenException('The person who initiated the exit cannot also sign off the settlement');
    }

    // Freeze the final figure at sign-off time rather than trusting the draft.
    const settlement = await this.payroll.calculateFinalSettlement(tenantId, c.employeeId, c.lastWorkingDay);
    const newStatus = c.type === 'TERMINATION' ? 'TERMINATED' : 'RESIGNED';
    const user = await this.prisma.user.findFirst({ where: { tenantId, employeeId: c.employeeId } });

    await this.prisma.$transaction([
      this.prisma.offboardingCase.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedByUserId: actor.userId,
          settlement: { ...settlement, finalisedAt: new Date().toISOString() } as any,
        },
      }),
      this.prisma.employee.update({ where: { id: c.employeeId }, data: { status: newStatus } }),
      this.prisma.employmentHistory.create({
        data: {
          employeeId: c.employeeId,
          event: newStatus,
          effectiveFrom: c.lastWorkingDay,
          salaryBefore: c.employee.baseSalary,
          notes: `Offboarding case ${id} completed. Final net settlement: ${settlement.net}`,
        },
      }),
      ...(user
        ? [
            this.prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } }),
            this.prisma.session.deleteMany({ where: { userId: user.id } }),
          ]
        : []),
    ]);

    // Future loan instalments were recovered in the settlement and approved claims paid in it — stop payroll doing either again.
    await this.payroll.closeOutForExit(tenantId, c.employeeId, c.lastWorkingDay);

    await this.audit.log({
      tenantId, userId: actor.userId, action: 'COMPLETE', entity: 'OffboardingCase', entityId: id,
      before: { status: c.status }, after: { status: 'COMPLETED', settlementNet: settlement.net },
    });
    await this.webhooks.dispatch(tenantId, 'employee.terminated', {
      employeeId: c.employeeId,
      employeeCode: c.employee.employeeCode,
      name: `${c.employee.firstName} ${c.employee.lastName}`,
      email: c.employee.email,
      terminatedAt: c.lastWorkingDay.toISOString(),
    });
    return this.get(tenantId, id, actor);
  }

  async cancel(tenantId: string, id: string, actor: Actor) {
    const c = await this.prisma.offboardingCase.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Offboarding case not found');
    if (!(OPEN_STATUSES as readonly string[]).includes(c.status)) {
      throw new BadRequestException('Only open cases can be cancelled');
    }
    await this.prisma.offboardingCase.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log({
      tenantId, userId: actor.userId, action: 'CANCEL', entity: 'OffboardingCase', entityId: id,
      before: { status: c.status },
    });
    return this.get(tenantId, id, actor);
  }
}
