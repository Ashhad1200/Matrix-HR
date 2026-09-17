import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollEngineFactory } from './engines/payroll-engine.factory';
import { PayrollRules } from './engines/payroll-engine.interface';
import { PayslipPdfService } from './payslip-pdf.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCompensationItemDto } from './dto';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private engineFactory: PayrollEngineFactory,
    private payslipPdf: PayslipPdfService,
    private uploads: UploadsService,
  ) {}

  // ── Period helpers ──────────────────────────────────────────────────────
  private periodRange(period: string) {
    const [y, m] = period.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1)); // exclusive
    const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86400000);
    return { start, end, daysInMonth };
  }

  // ── Effective-dated compliance rules ────────────────────────────────────
  private async resolveRules(country: string, period: string): Promise<PayrollRules | undefined> {
    const { start } = this.periodRange(period);
    const ruleSet = await this.prisma.payrollRuleSet.findFirst({
      where: {
        country,
        isActive: true,
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!ruleSet) return undefined; // engine falls back to its own hardcoded default

    const taxSlabs = (ruleSet.taxSlabs as { min: number; max: number | null; rate: number }[]).map((s) => ({
      min: s.min,
      max: s.max === null ? Infinity : s.max,
      rate: s.rate,
    }));

    return {
      taxSlabs,
      eobiEmployeeRate: Number(ruleSet.eobiEmployeeRate),
      eobiEmployerRate: Number(ruleSet.eobiEmployerRate),
      eobiMinWage: Number(ruleSet.eobiMinWage),
      pfRate: Number(ruleSet.pfRate),
      ruleSetId: ruleSet.id,
    };
  }

  // ── Configurable earnings/deductions ────────────────────────────────────
  private async resolveCompensation(tenantId: string, employeeId: string, period: string) {
    const items = await this.prisma.compensationItem.findMany({
      where: {
        tenantId,
        employeeId,
        OR: [
          {
            recurring: true,
            AND: [
              { OR: [{ startPeriod: null }, { startPeriod: { lte: period } }] },
              { OR: [{ endPeriod: null }, { endPeriod: { gte: period } }] },
            ],
          },
          { recurring: false, startPeriod: period },
        ],
      },
    });

    let taxableEarnings = 0;
    let postTaxDeductions = 0;
    for (const item of items) {
      const amt = Number(item.amount);
      if (['ALLOWANCE', 'BONUS', 'ARREARS'].includes(item.type)) taxableEarnings += amt;
      else if (['DEDUCTION', 'LOAN', 'ADVANCE'].includes(item.type)) postTaxDeductions += amt;
    }
    return { taxableEarnings, postTaxDeductions };
  }

  // ── Attendance-derived unpaid time ──────────────────────────────────────
  private async resolveUnpaidFraction(tenantId: string, employeeId: string, period: string) {
    const { start, end, daysInMonth } = this.periodRange(period);
    const logs = await this.prisma.attendanceLog.findMany({
      where: { tenantId, employeeId, date: { gte: start, lt: end }, status: { in: ['ABSENT', 'HALF_DAY'] } },
      select: { status: true },
    });
    const unpaidDays = logs.reduce((sum, l) => sum + (l.status === 'ABSENT' ? 1 : 0.5), 0);
    return daysInMonth > 0 ? Math.min(unpaidDays / daysInMonth, 1) : 0;
  }

  // ── Compensation items CRUD ─────────────────────────────────────────────
  async listCompensationItems(tenantId: string, employeeId?: string) {
    return this.prisma.compensationItem.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCompensationItem(tenantId: string, dto: CreateCompensationItemDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.compensationItem.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        type: dto.type,
        label: dto.label,
        amount: dto.amount,
        recurring: dto.recurring ?? true,
        startPeriod: dto.startPeriod,
        endPeriod: dto.endPeriod,
      },
    });
  }

  async deleteCompensationItem(tenantId: string, id: string) {
    const item = await this.prisma.compensationItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Compensation item not found');
    return this.prisma.compensationItem.delete({ where: { id } });
  }

  // ── Payroll run lifecycle: DRAFT -> REVIEW -> APPROVED -> LOCKED ───────
  async createPayrollRun(tenantId: string, period: string, preparedByUserId: string) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { tenantId_period: { tenantId, period } },
    });
    if (existing) throw new BadRequestException('Payroll run already exists for this period');

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', baseSalary: { not: null } },
    });

    const engine = await this.engineFactory.getEngine(tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    const country = tenant?.currency === 'USD' ? 'US' : 'PK';
    const rules = await this.resolveRules(country, period);

    const run = await this.prisma.payrollRun.create({
      data: { tenantId, period, status: 'DRAFT', preparedByUserId },
    });

    const items: Awaited<ReturnType<typeof this.prisma.payrollItem.create>>[] = [];
    for (const emp of employees) {
      const [{ taxableEarnings, postTaxDeductions }, unpaidFraction] = await Promise.all([
        this.resolveCompensation(tenantId, emp.id, period),
        this.resolveUnpaidFraction(tenantId, emp.id, period),
      ]);

      const calc = engine.calculate(Number(emp.baseSalary), { rules, taxableEarnings, postTaxDeductions, unpaidFraction });

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

  async submitForReview(tenantId: string, runId: string) {
    const run = await this.getRunOrThrow(tenantId, runId);
    if (run.status !== 'DRAFT') throw new BadRequestException(`Cannot submit a run in status ${run.status} for review`);
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'REVIEW', submittedForReviewAt: new Date() },
    });
  }

  /** Maker-checker: the user who prepared the run cannot also approve it. */
  async approvePayrollRun(tenantId: string, runId: string, approverId: string) {
    const run = await this.getRunOrThrow(tenantId, runId);
    if (run.status !== 'REVIEW') {
      throw new BadRequestException(`Cannot approve a run in status ${run.status} — submit it for review first`);
    }
    if (run.preparedByUserId && run.preparedByUserId === approverId) {
      throw new ForbiddenException('The person who prepared this payroll run cannot also approve it');
    }
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'APPROVED',
        approvedByUserId: approverId,
        approvedAt: new Date(),
        processedAt: new Date(),
        approvedBy: approverId,
      },
    });
  }

  /** Locking generates and archives payslips, then freezes the run. */
  async lockPayrollRun(tenantId: string, runId: string) {
    const run = await this.getRunOrThrow(tenantId, runId);
    if (run.status !== 'APPROVED') throw new BadRequestException(`Cannot lock a run in status ${run.status}`);

    await this.generatePayslipsForRun(tenantId, runId);

    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });
  }

  /** Controlled reopen: requires a reason, always audited via the run's own reopened* fields. */
  async reopenPayrollRun(tenantId: string, runId: string, operatorId: string, reason: string) {
    const run = await this.getRunOrThrow(tenantId, runId);
    if (run.status !== 'LOCKED') throw new BadRequestException('Only a locked run can be reopened');
    if (!reason?.trim()) throw new BadRequestException('A reason is required to reopen a locked payroll run');

    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'DRAFT', reopenedByUserId: operatorId, reopenedAt: new Date(), reopenReason: reason },
    });
  }

  private async getRunOrThrow(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
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
                designation: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async generatePayslipsForRun(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    for (const item of run.items) {
      if (item.payslipUrl) continue; // idempotent — safe to call repeatedly
      const buffer = await this.payslipPdf.generate({
        tenantName: tenant?.name ?? 'MatrixHR',
        period: run.period,
        employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
        employeeCode: item.employee.employeeCode,
        designation: item.employee.designation?.name,
        department: item.employee.department?.name,
        breakdown: (item.breakdown ?? {}) as any,
      });
      const { url } = await this.uploads.uploadBuffer(
        tenantId,
        buffer,
        `payslip-${run.period}-${item.employee.employeeCode}.pdf`,
        'application/pdf',
      );
      await this.prisma.payrollItem.update({ where: { id: item.id }, data: { payslipUrl: url } });
    }
  }

  /** Generates on demand if the run was locked before payslips existed, or for a still-open run. */
  async getPayslipUrl(tenantId: string, itemId: string) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id: itemId, payrollRun: { tenantId } },
      include: { payrollRun: true, employee: { include: { designation: true, department: true } } },
    });
    if (!item) throw new NotFoundException('Payslip not found');
    if (item.payslipUrl) return { url: item.payslipUrl };

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const buffer = await this.payslipPdf.generate({
      tenantName: tenant?.name ?? 'MatrixHR',
      period: item.payrollRun.period,
      employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
      employeeCode: item.employee.employeeCode,
      designation: item.employee.designation?.name,
      department: item.employee.department?.name,
      breakdown: (item.breakdown ?? {}) as any,
    });
    const { url } = await this.uploads.uploadBuffer(
      tenantId,
      buffer,
      `payslip-${item.payrollRun.period}-${item.employee.employeeCode}.pdf`,
      'application/pdf',
    );
    await this.prisma.payrollItem.update({ where: { id: item.id }, data: { payslipUrl: url } });
    return { url };
  }

  /**
   * ponytail: these are illustrative field layouts, not validated against
   * real HBL/Meezan bank specifications — see ENGINEERING_ROADMAP.md Phase 2.
   * Do not use for a real disbursement until a bank confirms the format.
   */
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
    return { bank, period: run.period, format: 'csv', content: lines.join('\n'), validated: false };
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
