import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getHrDashboard(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [headcount, pendingLeave, onLeaveToday, onboarding, attendance] = await Promise.all([
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
    ]);

    const nextHoliday = await this.prisma.holiday.findFirst({
      where: { tenantId, date: { gte: today } },
      orderBy: { date: 'asc' },
    });

    return { headcount, pendingLeave, onLeaveToday, onboarding, presentToday: attendance, nextHoliday };
  }

  async getManagerDashboard(tenantId: string, managerId: string) {
    const team = await this.prisma.employee.findMany({
      where: { tenantId, managerId, status: 'ACTIVE' },
      select: { id: true },
    });
    const teamIds = team.map((t) => t.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingApprovals, teamOnLeave] = await Promise.all([
      this.prisma.leaveRequest.count({
        where: { tenantId, approverId: managerId, status: 'PENDING' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId, employeeId: { in: teamIds }, status: 'APPROVED',
          startDate: { lte: today }, endDate: { gte: today },
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return { teamSize: team.length, pendingApprovals, teamOnLeave };
  }

  async getEmployeeDashboard(tenantId: string, employeeId: string) {
    const year = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [balances, todayAttendance, pendingTasks] = await Promise.all([
      this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId, year },
        include: { policy: true },
      }),
      this.prisma.attendanceLog.findUnique({
        where: { tenantId_employeeId_date: { tenantId, employeeId, date: today } },
      }),
      this.prisma.leaveRequest.count({ where: { tenantId, employeeId, status: 'PENDING' } }),
    ]);

    const nextHoliday = await this.prisma.holiday.findFirst({
      where: { tenantId, date: { gte: today } },
      orderBy: { date: 'asc' },
    });

    return { balances, todayAttendance, pendingLeaveRequests: pendingTasks, nextHoliday };
  }
}
