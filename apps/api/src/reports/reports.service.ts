import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async headcountByDepartment(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
    });
    return departments.map((d) => ({ department: d.name, count: d._count.employees }));
  }

  async leaveConsumption(tenantId: string, year?: number) {
    const y = year || new Date().getFullYear();
    const balances = await this.prisma.leaveBalance.findMany({
      where: { tenantId, year: y },
      include: { policy: true, employee: { select: { firstName: true, lastName: true } } },
    });
    return balances.map((b) => ({
      employee: `${b.employee.firstName} ${b.employee.lastName}`,
      policy: b.policy.name,
      entitled: Number(b.entitled),
      used: Number(b.used),
      remaining: Number(b.entitled) - Number(b.used),
    }));
  }

  async attendanceSummary(tenantId: string, month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    const logs = await this.prisma.attendanceLog.findMany({
      where: { tenantId, date: { gte: start, lte: end } },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });

    const byEmployee = new Map<string, { present: number; absent: number; late: number }>();
    for (const log of logs) {
      const key = log.employeeId;
      if (!byEmployee.has(key)) byEmployee.set(key, { present: 0, absent: 0, late: 0 });
      const entry = byEmployee.get(key)!;
      if (log.status === 'PRESENT') entry.present++;
      if (log.status === 'ABSENT') entry.absent++;
      if (log.clockIn && log.clockIn.getHours() >= 10) entry.late++;
    }

    return Array.from(byEmployee.entries()).map(([employeeId, stats]) => {
      const emp = logs.find((l) => l.employeeId === employeeId)?.employee;
      return { employeeId, name: emp ? `${emp.firstName} ${emp.lastName}` : employeeId, ...stats };
    });
  }

  async payrollCostAnalysis(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', baseSalary: { not: null } },
      include: { department: true },
    });

    const byDept = new Map<string, number>();
    for (const emp of employees) {
      const dept = emp.department?.name || 'Unassigned';
      byDept.set(dept, (byDept.get(dept) || 0) + Number(emp.baseSalary));
    }

    return Array.from(byDept.entries()).map(([department, totalSalary]) => ({ department, totalSalary }));
  }
}
