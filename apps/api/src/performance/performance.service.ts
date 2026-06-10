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

  async getReviews(tenantId: string, cycleId?: string) {
    const reviews = await this.prisma.performanceReview.findMany({
      where: { tenantId, ...(cycleId ? { cycleId } : {}) },
      include: { cycle: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve employee/reviewer names in one query
    const ids = [...new Set(reviews.flatMap((r) => [r.employeeId, r.reviewerId]))];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, designation: { select: { name: true } } },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    return reviews.map((r) => ({
      ...r,
      employee: empMap.get(r.employeeId) ?? null,
      reviewer: empMap.get(r.reviewerId) ?? null,
    }));
  }

  async createReview(tenantId: string, data: { cycleId: string; employeeId: string; reviewerId: string }) {
    return this.prisma.performanceReview.create({
      data: {
        tenantId,
        cycleId: data.cycleId,
        employeeId: data.employeeId,
        reviewerId: data.reviewerId,
      },
    });
  }

  async submitReview(
    tenantId: string,
    id: string,
    data: { selfRating?: number; managerRating?: number; feedback?: string; status?: string },
  ) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id, tenantId } });
    if (!review) return null;
    return this.prisma.performanceReview.update({
      where: { id },
      data: {
        ...(data.selfRating != null ? { selfRating: data.selfRating } : {}),
        ...(data.managerRating != null ? { managerRating: data.managerRating } : {}),
        ...(data.feedback !== undefined ? { feedback: data.feedback } : {}),
        status: data.status ?? 'submitted',
      },
    });
  }
}
