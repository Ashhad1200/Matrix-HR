import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollEngineFactory } from './engines/payroll-engine.factory';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private engineFactory: PayrollEngineFactory,
  ) {}

  async createPayrollRun(tenantId: string, period: string) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { tenantId_period: { tenantId, period } },
    });
    if (existing) throw new BadRequestException('Payroll run already exists for this period');

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', baseSalary: { not: null } },
    });

    const engine = await this.engineFactory.getEngine(tenantId);

    const run = await this.prisma.payrollRun.create({
      data: { tenantId, period, status: 'DRAFT' },
    });

    const items: Awaited<ReturnType<typeof this.prisma.payrollItem.create>>[] = [];
    for (const emp of employees) {
      const calc = engine.calculate(Number(emp.baseSalary));

      const item = await this.prisma.payrollItem.create({
        data: {
          payrollRunId: run.id,
          employeeId: emp.id,
          grossSalary: calc.gross,
          deductions: calc.deductions,
          netSalary: calc.net,
          taxAmount: calc.tax,
          eobiAmount: calc.eobiAmount ?? 0,
          pfAmount: calc.pfAmount ?? 0,
          breakdown: calc.breakdown as any,
        },
      });
      items.push(item);
    }

    return {
      run,
      items,
      summary: {
        totalEmployees: items.length,
        totalGross: items.reduce((s, i) => s + Number(i.grossSalary), 0),
        totalNet: items.reduce((s, i) => s + Number(i.netSalary), 0),
      },
    };
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
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                bankAccount: true,
                iban: true,
              },
            },
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

  /** Annual W-2 wage & tax statements aggregated from approved payroll items. */
  async generateW2Forms(tenantId: string, year: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const items = await this.prisma.payrollItem.findMany({
      where: {
        employee: { tenantId },
        payrollRun: { tenantId, period: { startsWith: String(year) } },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, ntn: true } },
      },
    });

    const byEmployee = new Map<string, { employee: (typeof items)[number]['employee']; wages: number; federalTax: number; socialSecurity: number; medicare: number }>();
    for (const item of items) {
      const breakdown = (item.breakdown ?? {}) as Record<string, number>;
      const bucket = byEmployee.get(item.employeeId) ?? {
        employee: item.employee,
        wages: 0,
        federalTax: 0,
        socialSecurity: 0,
        medicare: 0,
      };
      bucket.wages += Number(item.grossSalary);
      bucket.federalTax += Number(breakdown.federalTax ?? item.taxAmount ?? 0);
      bucket.socialSecurity += Number(breakdown.socialSecurity ?? 0);
      bucket.medicare += Number(breakdown.medicare ?? 0);
      byEmployee.set(item.employeeId, bucket);
    }

    const forms = [...byEmployee.values()].map((b) => ({
      formType: 'W-2',
      taxYear: year,
      employer: { name: tenant?.name, ein: 'XX-XXXXXXX' },
      employee: {
        id: b.employee.id,
        name: `${b.employee.firstName} ${b.employee.lastName}`,
        code: b.employee.employeeCode,
        tin: b.employee.ntn ?? 'on-file',
      },
      box1_wages: Math.round(b.wages),
      box2_federalIncomeTax: Math.round(b.federalTax),
      box3_socialSecurityWages: Math.round(b.wages),
      box4_socialSecurityTax: Math.round(b.socialSecurity),
      box5_medicareWages: Math.round(b.wages),
      box6_medicareTax: Math.round(b.medicare),
    }));

    return { taxYear: year, count: forms.length, forms };
  }
}
