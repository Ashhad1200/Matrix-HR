import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EMP_LITE = { select: { id: true, firstName: true, lastName: true, photoUrl: true } };

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private async getWhosOutToday(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.leaveRequest.findMany({
      where: { tenantId, status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
      include: { employee: EMP_LITE, policy: { select: { name: true } } },
      take: 8,
    });
  }

  /** Birthdays and work anniversaries in the next 30 days. */
  private async getCelebrations(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, photoUrl: true, dateOfBirth: true, dateOfJoining: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 30);

    const upcoming: { employee: any; type: 'birthday' | 'anniversary'; date: string; years?: number }[] = [];
    for (const emp of employees) {
      for (const [field, type] of [['dateOfBirth', 'birthday'], ['dateOfJoining', 'anniversary']] as const) {
        const src = emp[field];
        if (!src) continue;
        const next = new Date(src);
        next.setFullYear(today.getFullYear());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        if (next <= windowEnd) {
          const years = type === 'anniversary' ? next.getFullYear() - new Date(src).getFullYear() : undefined;
          if (type === 'anniversary' && (!years || years < 1)) continue;
          upcoming.push({
            employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, photoUrl: emp.photoUrl },
            type,
            date: next.toISOString(),
            years,
          });
        }
      }
    }
    return upcoming.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  }

  async getHrDashboard(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [headcount, pendingLeave, onLeaveToday, onboarding, attendance, openJobs] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId, status: 'APPROVED',
          startDate: { lte: today }, endDate: { gte: today },
        },
      }),
      this.prisma.onboardingProgress.count({ where: { tenantId, status: 'in_progress' } }),
      this.prisma.attendanceLog.count({ where: { tenantId, date: today, clockIn: { not: null } } }),
      this.prisma.jobPosting.count({ where: { tenantId, status: 'open' } }),
    ]);

    const [nextHoliday, departments, recentHires, whosOut, celebrations] = await Promise.all([
      this.prisma.holiday.findFirst({ where: { tenantId, date: { gte: today } }, orderBy: { date: 'asc' } }),
      this.prisma.department.findMany({
        where: { tenantId },
        select: { name: true, _count: { select: { employees: { where: { status: 'ACTIVE' } } } } },
      }),
      this.prisma.employee.findMany({
        where: { tenantId, status: 'ACTIVE', dateOfJoining: { not: null } },
        orderBy: { dateOfJoining: 'desc' },
        take: 5,
        select: {
          id: true, firstName: true, lastName: true, photoUrl: true, dateOfJoining: true,
          designation: { select: { name: true } },
        },
      }),
      this.getWhosOutToday(tenantId),
      this.getCelebrations(tenantId),
    ]);

    const departmentDistribution = departments
      .map((d) => ({ name: d.name, count: d._count.employees }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      headcount,
      pendingLeave,
      onLeaveToday,
      onboarding,
      presentToday: attendance,
      openJobs,
      nextHoliday,
      departmentDistribution,
      recentHires,
      whosOut,
      celebrations,
    };
  }

  async getManagerDashboard(tenantId: string, managerId: string) {
    const team = await this.prisma.employee.findMany({
      where: { tenantId, managerId, status: 'ACTIVE' },
      select: {
        id: true, firstName: true, lastName: true, photoUrl: true,
        designation: { select: { name: true } },
      },
    });
    const teamIds = team.map((t) => t.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingApprovals, teamOnLeave, nextHoliday, celebrations] = await Promise.all([
      this.prisma.leaveRequest.count({
        where: { tenantId, approverId: managerId, status: 'PENDING' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId, employeeId: { in: teamIds }, status: 'APPROVED',
          startDate: { lte: today }, endDate: { gte: today },
        },
        include: { employee: EMP_LITE },
      }),
      this.prisma.holiday.findFirst({
        where: { tenantId, date: { gte: today } },
        orderBy: { date: 'asc' },
      }),
      this.getCelebrations(tenantId),
    ]);

    return { teamSize: team.length, teamMembers: team, pendingApprovals, teamOnLeave, nextHoliday, celebrations };
  }

  async getEmployeeDashboard(tenantId: string, employeeId: string) {
    const year = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [balances, todayAttendance, pendingTasks, nextHoliday, whosOut, celebrations] = await Promise.all([
      this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId, year },
        include: { policy: true },
      }),
      this.prisma.attendanceLog.findUnique({
        where: { tenantId_employeeId_date: { tenantId, employeeId, date: today } },
      }),
      this.prisma.leaveRequest.count({ where: { tenantId, employeeId, status: 'PENDING' } }),
      this.prisma.holiday.findFirst({ where: { tenantId, date: { gte: today } }, orderBy: { date: 'asc' } }),
      this.getWhosOutToday(tenantId),
      this.getCelebrations(tenantId),
    ]);

    return {
      balances,
      todayAttendance,
      pendingLeaveRequests: pendingTasks,
      nextHoliday,
      whosOut,
      celebrations,
    };
  }
}
