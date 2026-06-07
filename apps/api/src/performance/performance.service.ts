import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService) {}

  async getCycles(tenantId: string) {
    return this.prisma.reviewCycle.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createCycle(tenantId: string, data: {
    name: string; type?: string; startDate: string; endDate: string;
  }) {
    return this.prisma.reviewCycle.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type || 'quarterly',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: 'ACTIVE',
      },
    });
  }

  async getGoals(tenantId: string, employeeId?: string) {
    return this.prisma.goal.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGoal(tenantId: string, data: {
    employeeId: string; title: string; description?: string; dueDate?: string; cycleId?: string;
  }) {
    return this.prisma.goal.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        cycleId: data.cycleId,
      },
    });
  }

  async updateGoalProgress(goalId: string, progress: number) {
    return this.prisma.goal.update({
      where: { id: goalId },
      data: { progress: Math.min(100, Math.max(0, progress)) },
    });
  }
}
