import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type WorkflowActor = { userId: string; role: string; employeeId?: string | null };
export type WorkflowStep = { order: number; role: string; action?: string };

type InstanceRecord = Awaited<ReturnType<WorkflowEngineService['getInstanceOrThrow']>>;

export interface WorkflowHandler {
  onApproved(instance: InstanceRecord): Promise<void>;
  onRejected(instance: InstanceRecord, reason?: string): Promise<void>;
}

// Used when a tenant has not configured a definition for a trigger, so the
// engine works out of the box and tenants can override by creating their own.
const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  'leave.request': [{ order: 0, role: 'MANAGER', action: 'approve' }],
  'offboarding.resignation': [
    { order: 0, role: 'MANAGER', action: 'approve' },
    { order: 1, role: 'HR_MANAGER', action: 'approve' },
  ],
  'offboarding.termination': [{ order: 0, role: 'HR_MANAGER', action: 'approve' }],
  'expense.claim': [
    { order: 0, role: 'MANAGER', action: 'approve' },
    { order: 1, role: 'HR_MANAGER', action: 'approve' },
  ],
  'loan.request': [
    { order: 0, role: 'HR_MANAGER', action: 'approve' },
    { order: 1, role: 'COMPANY_ADMIN', action: 'approve' },
  ],
};

const ROLE_RANK: Record<string, number> = {
  EMPLOYEE: 0,
  MANAGER: 1,
  HR_MANAGER: 2,
  COMPANY_ADMIN: 3,
  SUPER_ADMIN: 4,
};

export const roleRank = (role: string) => ROLE_RANK[role] ?? -1;

@Injectable()
export class WorkflowEngineService {
  private handlers = new Map<string, WorkflowHandler>();

  constructor(private prisma: PrismaService) {}

  registerHandler(entityType: string, handler: WorkflowHandler) {
    this.handlers.set(entityType, handler);
  }

  private async resolveDefinition(tenantId: string, trigger: string) {
    const existing = await this.prisma.workflowDefinition.findFirst({
      where: { tenantId, trigger, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const steps = DEFAULT_STEPS[trigger];
    if (!steps) throw new BadRequestException(`No workflow is configured for trigger "${trigger}"`);
    return this.prisma.workflowDefinition.create({
      data: { tenantId, name: `Default: ${trigger}`, trigger, steps: steps as any },
    });
  }

  async start(params: {
    tenantId: string;
    trigger: string;
    entityType: string;
    entityId: string;
    requestedByUserId?: string | null;
    subjectEmployeeId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const definition = await this.resolveDefinition(params.tenantId, params.trigger);
    const instance = await this.prisma.workflowInstance.create({
      data: {
        tenantId: params.tenantId,
        definitionId: definition.id,
        entityType: params.entityType,
        entityId: params.entityId,
        requestedByUserId: params.requestedByUserId ?? undefined,
        subjectEmployeeId: params.subjectEmployeeId ?? undefined,
        metadata: params.metadata as any,
      },
    });

    // A definition with no steps means "no approval needed".
    if (this.stepsOf(definition).length === 0) return this.finish(params.tenantId, instance.id, 'approved');
    return this.getInstanceOrThrow(params.tenantId, instance.id);
  }

  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findFirst({
      where: { tenantId, entityType, entityId },
      include: { definition: true, actions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInstanceOrThrow(tenantId: string, id: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id, tenantId },
      include: { definition: true, actions: { orderBy: { createdAt: 'asc' } } },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return instance;
  }

  private stepsOf(definition: { steps: unknown }): WorkflowStep[] {
    const steps = (definition.steps as WorkflowStep[]) ?? [];
    return [...steps].sort((a, b) => a.order - b.order);
  }

  /** Who may act on the instance's current step, as a role name (for UI hints). */
  currentStepRole(instance: InstanceRecord): string | null {
    if (instance.status !== 'pending') return null;
    return this.stepsOf(instance.definition)[instance.currentStep]?.role ?? null;
  }

  /**
   * Authorization for one step: the actor must hold the step's role or higher,
   * cannot be the requester (segregation of duties), and a plain MANAGER must
   * be the subject employee's direct manager.
   */
  async assertCanAct(tenantId: string, instance: InstanceRecord, actor: WorkflowActor) {
    const step = this.stepsOf(instance.definition)[instance.currentStep];
    if (!step) throw new BadRequestException('Workflow has no remaining steps');

    if (roleRank(actor.role) < (ROLE_RANK[step.role] ?? 99)) {
      throw new ForbiddenException(`This step requires the ${step.role} role or higher`);
    }
    if (instance.requestedByUserId && instance.requestedByUserId === actor.userId) {
      throw new ForbiddenException('You cannot act on a request you raised yourself');
    }
    if (actor.role === 'MANAGER' && instance.subjectEmployeeId) {
      const subject = await this.prisma.employee.findFirst({
        where: { id: instance.subjectEmployeeId, tenantId },
        select: { managerId: true },
      });
      if (!subject || !actor.employeeId || subject.managerId !== actor.employeeId) {
        throw new ForbiddenException('Only the employee\'s direct manager can act on this request');
      }
    }
  }

  async act(
    tenantId: string,
    instanceId: string,
    actor: WorkflowActor,
    action: 'APPROVE' | 'REJECT',
    comment?: string,
  ) {
    const instance = await this.getInstanceOrThrow(tenantId, instanceId);
    if (instance.status !== 'pending') {
      throw new BadRequestException(`Request is already ${instance.status}`);
    }
    await this.assertCanAct(tenantId, instance, actor);

    const isLast = instance.currentStep >= this.stepsOf(instance.definition).length - 1;
    const finalStatus = action === 'REJECT' ? 'rejected' : isLast ? 'approved' : null;

    // The transition itself is the concurrency guard: it only matches while the
    // instance is still pending at the step this actor saw, so of two racing
    // approvers exactly one gets count === 1.
    const moved = await this.prisma.workflowInstance.updateMany({
      where: { id: instanceId, status: 'pending', currentStep: instance.currentStep },
      data: finalStatus
        ? { status: finalStatus, completedAt: new Date() }
        : { currentStep: instance.currentStep + 1 },
    });
    if (moved.count === 0) throw new BadRequestException('Request was just updated by someone else');

    await this.prisma.workflowStepAction.create({
      data: {
        instanceId,
        stepIndex: instance.currentStep,
        actorUserId: actor.userId,
        actorRole: actor.role,
        action,
        comment,
      },
    });

    if (!finalStatus) return this.getInstanceOrThrow(tenantId, instanceId);
    return this.runHandler(tenantId, instanceId, finalStatus, comment);
  }

  private async runHandler(tenantId: string, instanceId: string, status: 'approved' | 'rejected', reason?: string) {
    const instance = await this.getInstanceOrThrow(tenantId, instanceId);
    const handler = this.handlers.get(instance.entityType);
    if (handler) {
      if (status === 'approved') await handler.onApproved(instance);
      else await handler.onRejected(instance, reason);
    }
    return instance;
  }

  private async finish(tenantId: string, instanceId: string, status: 'approved' | 'rejected') {
    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status, completedAt: new Date() },
    });
    return this.runHandler(tenantId, instanceId, status);
  }
}
