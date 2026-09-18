import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Viewer, isHrPlus, scopedEmployeeIds, employeeIdFilter, assertInTenant } from '../common/data-scope';

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

  async getGoals(tenantId: string, employeeId: string | undefined, viewer: Viewer) {
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    return this.prisma.goal.findMany({
      where: { tenantId, ...employeeIdFilter(allowed, employeeId) },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Non-HR users may only set goals for people inside their own visibility (themself / their reports). */
  async createGoal(tenantId: string, viewer: Viewer, data: {
    employeeId?: string; title: string; description?: string; dueDate?: string; cycleId?: string;
  }) {
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    const employeeId = data.employeeId ?? viewer.employeeId;
    if (!employeeId) throw new ForbiddenException('No employee profile is linked to this account');
    if (allowed !== null && !allowed.includes(employeeId)) throw new ForbiddenException('You cannot set goals for this employee');
    await assertInTenant(this.prisma, tenantId, [
      { model: 'employee', id: employeeId },
      { model: 'reviewCycle', id: data.cycleId, label: 'cycle' },
    ]);
    return this.prisma.goal.create({
      data: {
        tenantId,
        employeeId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        cycleId: data.cycleId,
      },
    });
  }

  async updateGoalProgress(tenantId: string, viewer: Viewer, goalId: string, progress: number) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, tenantId } });
    if (!goal) throw new NotFoundException('Goal not found');
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    if (allowed !== null && !allowed.includes(goal.employeeId)) throw new ForbiddenException('You cannot update this goal');
    return this.prisma.goal.update({
      where: { id: goalId },
      data: { progress: Math.min(100, Math.max(0, progress)) },
    });
  }

  async getReviews(tenantId: string, cycleId: string | undefined, viewer: Viewer) {
    const allowed = await scopedEmployeeIds(this.prisma, tenantId, viewer);
    const visible = allowed === null
      ? {}
      : { OR: [{ employeeId: { in: allowed } }, ...(viewer.employeeId ? [{ reviewerId: viewer.employeeId }] : [])] };
    const reviews = await this.prisma.performanceReview.findMany({
      where: { tenantId, ...visible, ...(cycleId ? { cycleId } : {}) },
      include: { cycle: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve employee/reviewer names in one query
    const ids = [...new Set(reviews.flatMap((r) => [r.employeeId, r.reviewerId]))];
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, id: { in: ids } },
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
    await assertInTenant(this.prisma, tenantId, [
      { model: 'reviewCycle', id: data.cycleId, label: 'cycle' },
      { model: 'employee', id: data.employeeId },
      { model: 'employee', id: data.reviewerId, label: 'reviewer' },
    ]);
    return this.prisma.performanceReview.create({
      data: {
        tenantId,
        cycleId: data.cycleId,
        employeeId: data.employeeId,
        reviewerId: data.reviewerId,
      },
    });
  }

  /**
   * HR can edit anything; the assigned reviewer writes the manager rating and feedback; the employee
   * being reviewed can only give their own self-rating.
   */
  async submitReview(
    tenantId: string,
    viewer: Viewer,
    id: string,
    data: { selfRating?: number; managerRating?: number; feedback?: string; status?: string },
  ) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id, tenantId } });
    if (!review) throw new NotFoundException('Review not found');

    const hr = isHrPlus(viewer.role);
    const isReviewer = !!viewer.employeeId && viewer.employeeId === review.reviewerId;
    const isSubject = !!viewer.employeeId && viewer.employeeId === review.employeeId;
    if (!hr && !isReviewer && !isSubject) throw new ForbiddenException('You cannot update this review');
    if (!hr && !isReviewer && (data.managerRating != null || data.feedback !== undefined)) {
      throw new ForbiddenException('Only the assigned reviewer can set the manager rating or feedback');
    }

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
