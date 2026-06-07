import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAKISTAN_TAX_SLABS_2025,
  EOBI_EMPLOYEE_RATE,
  EOBI_EMPLOYER_RATE,
  EOBI_MIN_WAGE,
} from '@matrixhr/shared';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  calculateMonthlyTax(annualSalary: number): number {
    let tax = 0;
    let remaining = annualSalary;

    for (const slab of PAKISTAN_TAX_SLABS_2025) {
      const slabMax = slab.max === Infinity ? remaining : slab.max;
      const taxableInSlab = Math.min(remaining, slabMax - slab.min + 1);
      if (taxableInSlab <= 0) break;
      tax += taxableInSlab * slab.rate;
      remaining -= taxableInSlab;
      if (remaining <= 0) break;
    }

    return Math.round(tax / 12);
  }

  calculateEobi(grossSalary: number) {
    const base = Math.max(Number(grossSalary), EOBI_MIN_WAGE);
    return {
      employee: Math.round(base * EOBI_EMPLOYEE_RATE),
      employer: Math.round(base * EOBI_EMPLOYER_RATE),
    };
  }

  calculatePf(grossSalary: number, rate = 0.08) {
    const amount = Math.round(Number(grossSalary) * rate);
    return { employee: amount, employer: amount };
  }

  async createPayrollRun(tenantId: string, period: string) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { tenantId_period: { tenantId, period } },
    });
    if (existing) throw new BadRequestException('Payroll run already exists for this period');

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', baseSalary: { not: null } },
    });

    const run = await this.prisma.payrollRun.create({
      data: { tenantId, period, status: 'DRAFT' },
    });

    const items: Awaited<ReturnType<typeof this.prisma.payrollItem.create>>[] = [];
    for (const emp of employees) {
      const gross = Number(emp.baseSalary);
      const tax = this.calculateMonthlyTax(gross * 12);
      const eobi = this.calculateEobi(gross);
      const pf = this.calculatePf(gross);
      const deductions = tax + eobi.employee + pf.employee;
      const net = gross - deductions;

      const item = await this.prisma.payrollItem.create({
        data: {
          payrollRunId: run.id,
          employeeId: emp.id,
          grossSalary: gross,
          deductions,
          netSalary: net,
          taxAmount: tax,
          eobiAmount: eobi.employee,
          pfAmount: pf.employee,
          breakdown: {
            gross,
            tax,
            eobiEmployee: eobi.employee,
            eobiEmployer: eobi.employer,
            pfEmployee: pf.employee,
            pfEmployer: pf.employer,
            net,
          },
        },
      });
      items.push(item);
    }

    return { run, items, summary: { totalEmployees: items.length, totalGross: items.reduce((s, i) => s + Number(i.grossSalary), 0), totalNet: items.reduce((s, i) => s + Number(i.netSalary), 0) } };
  }

  async approvePayrollRun(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
    if (!run) throw new NotFoundException('Payroll run not found');

    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'APPROVED', processedAt: new Date() },
    });
  }

  async getPayrollRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      include: { _count: { select: { items: true } } },
      orderBy: { period: 'desc' },
    });
  }

  async getPayrollRun(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        items: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, bankAccount: true, iban: true } },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  generateBankFile(run: Awaited<ReturnType<typeof this.getPayrollRun>>, bank: string) {
    const lines = run.items.map((item) => {
      const emp = item.employee;
      switch (bank) {
        case 'meezan':
          return `${emp.iban || emp.bankAccount},${emp.firstName} ${emp.lastName},${item.netSalary},Salary ${run.period}`;
        case 'hbl':
          return `HBL|${emp.iban}|${item.netSalary}|${emp.employeeCode}|Salary`;
        default:
          return `${emp.employeeCode},${emp.firstName} ${emp.lastName},${emp.iban || emp.bankAccount},${item.netSalary}`;
      }
    });
    return { bank, period: run.period, format: 'csv', content: lines.join('\n') };
  }
}
