import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';

const steps = [
  { order: 0, role: 'MANAGER' },
  { order: 1, role: 'HR_MANAGER' },
];

function setup(overrides: { instance?: any; managerId?: string | null; moved?: number } = {}) {
  const instance = {
    id: 'i1', tenantId: 't1', status: 'pending', currentStep: 0, entityType: 'X', entityId: 'e1',
    requestedByUserId: 'requester', subjectEmployeeId: 'emp1', definition: { steps }, actions: [],
    ...overrides.instance,
  };
  const prisma: any = {
    workflowInstance: {
      findFirst: jest.fn().mockResolvedValue(instance),
      updateMany: jest.fn().mockResolvedValue({ count: overrides.moved ?? 1 }),
    },
    workflowStepAction: { create: jest.fn().mockResolvedValue({}) },
    employee: { findFirst: jest.fn().mockResolvedValue({ managerId: overrides.managerId ?? 'mgr1' }) },
  };
  const engine = new WorkflowEngineService(prisma);
  const handler = { onApproved: jest.fn(), onRejected: jest.fn() };
  engine.registerHandler('X', handler);
  return { engine, prisma, handler, instance };
}

const manager = { userId: 'u-mgr', role: 'MANAGER', employeeId: 'mgr1' };

describe('WorkflowEngineService.act', () => {
  it('lets the direct manager advance a multi-step workflow without firing the handler', async () => {
    const { engine, prisma, handler } = setup();
    await engine.act('t1', 'i1', manager, 'APPROVE');
    expect(prisma.workflowInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStep: 1 } }),
    );
    expect(handler.onApproved).not.toHaveBeenCalled();
  });

  it('fires onApproved only on the last step', async () => {
    const { engine, handler } = setup({ instance: { currentStep: 1 } });
    await engine.act('t1', 'i1', { userId: 'u-hr', role: 'HR_MANAGER', employeeId: 'hr1' }, 'APPROVE');
    expect(handler.onApproved).toHaveBeenCalledTimes(1);
  });

  it('fires onRejected immediately on reject', async () => {
    const { engine, handler } = setup();
    await engine.act('t1', 'i1', manager, 'REJECT', 'no');
    expect(handler.onRejected).toHaveBeenCalledWith(expect.anything(), 'no');
  });

  it('rejects an actor below the step role', async () => {
    const { engine } = setup();
    await expect(engine.act('t1', 'i1', { userId: 'u', role: 'EMPLOYEE', employeeId: 'x' }, 'APPROVE'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks the requester from acting on their own request, whatever their rank', async () => {
    const { engine } = setup();
    await expect(engine.act('t1', 'i1', { userId: 'requester', role: 'COMPANY_ADMIN', employeeId: 'a' }, 'APPROVE'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a manager who is not the subject\'s direct manager', async () => {
    const { engine } = setup({ managerId: 'someone-else' });
    await expect(engine.act('t1', 'i1', manager, 'APPROVE')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to act on a finished instance', async () => {
    const { engine } = setup({ instance: { status: 'approved' } });
    await expect(engine.act('t1', 'i1', manager, 'APPROVE')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('loses cleanly when a concurrent actor already moved the step', async () => {
    const { engine, prisma, handler } = setup({ moved: 0 });
    await expect(engine.act('t1', 'i1', manager, 'APPROVE')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflowStepAction.create).not.toHaveBeenCalled();
    expect(handler.onApproved).not.toHaveBeenCalled();
  });
});
