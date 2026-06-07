import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async getProgress(tenantId: string, employeeId?: string) {
    return this.prisma.onboardingProgress.findMany({
      where: {
        tenantId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        template: true,
        tasks: { include: { task: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async completeTask(progressId: string, taskId: string) {
    return this.prisma.onboardingTaskProgress.update({
      where: { progressId_taskId: { progressId, taskId } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async getDashboard(tenantId: string) {
    const inProgress = await this.prisma.onboardingProgress.count({
      where: { tenantId, status: 'in_progress' },
    });
    const completed = await this.prisma.onboardingProgress.count({
      where: { tenantId, status: 'completed' },
    });
    const recent = await this.getProgress(tenantId);
    return { inProgress, completed, recent: recent.slice(0, 10) };
  }
}
