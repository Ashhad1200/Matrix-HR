import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Viewer, isHrPlus, scopedEmployeeIds, employeeIdFilter, assertInTenant } from '../common/data-scope';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getTemplates(tenantId: string) {
    return this.prisma.onboardingTemplate.findMany({
      where: { tenantId, isActive: true },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
  }

  async startOnboarding(tenantId: string, employeeId: string, templateId: string) {
    await assertInTenant(this.prisma, tenantId, [{ model: 'employee', id: employeeId }]);
    const template = await this.prisma.onboardingTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { tasks: true },
    });
    if (!template) throw new NotFoundException('Template not found');

    const progress = await this.prisma.onboardingProgress.create({
      data: {
        tenantId,
        employeeId,
        templateId,
        tasks: {
          create: template.tasks.map((t) => ({
            taskId: t.id,
            status: 'PENDING',
          })),
        },
      },
      include: {
        tasks: { include: { task: true } },
        template: true,
      },
    });

    return progress;
  }

  async getProgress(tenantId: string, employeeId: string | undefined, viewer: Viewer) {
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    return this.prisma.onboardingProgress.findMany({
      where: {
        tenantId,
        ...employeeIdFilter(allowed, employeeId),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        template: true,
        tasks: { include: { task: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** HR, the employee being onboarded, or their direct manager may tick a task off. */
  async completeTask(tenantId: string, viewer: Viewer, progressId: string, taskId: string) {
    const progress = await this.prisma.onboardingProgress.findFirst({
      where: { id: progressId, tenantId },
      include: { employee: { select: { managerId: true } } },
    });
    if (!progress) throw new NotFoundException('Onboarding record not found');
    const isSubject = !!viewer.employeeId && viewer.employeeId === progress.employeeId;
    const isManager = viewer.role === 'MANAGER' && !!viewer.employeeId && progress.employee.managerId === viewer.employeeId;
    if (!isHrPlus(viewer.role) && !isSubject && !isManager) {
      throw new ForbiddenException('You cannot update this onboarding record');
    }
    const taskProgress = await this.prisma.onboardingTaskProgress.findUnique({
      where: { progressId_taskId: { progressId, taskId } },
    });
    if (!taskProgress) throw new NotFoundException('Onboarding task not found');

    const result = await this.prisma.onboardingTaskProgress.update({
      where: { progressId_taskId: { progressId, taskId } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const remaining = await this.prisma.onboardingTaskProgress.count({
      where: { progressId, status: { not: 'COMPLETED' } },
    });
    if (remaining === 0) {
      await this.prisma.onboardingProgress.update({
        where: { id: progressId },
        data: { status: 'completed', completedAt: new Date() },
      });
    }

    return result;
  }

  async getDashboard(tenantId: string) {
    const inProgress = await this.prisma.onboardingProgress.count({
      where: { tenantId, status: 'in_progress' },
    });
    const completed = await this.prisma.onboardingProgress.count({
      where: { tenantId, status: 'completed' },
    });
    // The dashboard route is HR-only, so the unrestricted view is intended here.
    const recent = await this.getProgress(tenantId, undefined, { userId: 'system', role: 'HR_MANAGER' });
    return { inProgress, completed, recent: recent.slice(0, 10) };
  }
}
