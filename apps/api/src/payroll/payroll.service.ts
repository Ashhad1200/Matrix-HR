import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollEngineFactory } from './engines/payroll-engine.factory';
import { PayrollRules } from './engines/payroll-engine.interface';
import { PayslipPdfService } from './payslip-pdf.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCompensationItemDto } from './dto';
import { IntegrationSyncService } from '../integrations/integration-sync.service';
import { buildBankFile } from './bank-file';
import { buildJournal } from './journal';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private engineFactory: PayrollEngineFactory,
    private payslipPdf: PayslipPdfService,
    private uploads: UploadsService,
    private syncLogs: IntegrationSyncService,
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
    // Approved expense claims not yet paid out are reimbursed with this run (non-taxable, on top of net).
    const claims = await this.prisma.expenseClaim.findMany({
      where: { tenantId, employeeId, status: 'APPROVED' },
      select: { id: true, totalAmount: true },
    });
    const reimbursements = claims.reduce((sum, c) => sum + Number(c.totalAmount), 0);
    return { taxableEarnings, postTaxDeductions, reimbursements, claimIds: claims.map((c) => c.id) };
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
    if (item.sourceType) {
      throw new BadRequestException(`This item is managed by its ${item.sourceType === 'LoanRequest' ? 'loan' : 'source'} record — cancel that instead`);
    }
    return this.prisma.compensationItem.delete({ where: { id } });
  }

  // ── Final settlement (offboarding) ──────────────────────────────────────
  // Reuses the same engine/rules/attendance/compensation inputs as a normal
  // payroll run: the last partial month is pro-rated, unused annual leave is
  // encashed at base/30, and active loans/advances are recovered.
  async calculateFinalSettlement(tenantId: string, employeeId: string, lastWorkingDay: Date) {
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (emp.baseSalary == null) throw new BadRequestException('Employee has no base salary on record');

    const period = lastWorkingDay.toISOString().slice(0, 7);
    const { daysInMonth } = this.periodRange(period);
    const workedDays = lastWorkingDay.getUTCDate();
    const afterExitFraction = (daysInMonth - workedDays) / daysInMonth;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    const country = tenant?.currency === 'USD' ? 'US' : 'PK';
    const [engine, rules, comp, absentFraction, balances] = await Promise.all([
      this.engineFactory.getEngine(tenantId),
      this.resolveRules(country, period),
      this.resolveCompensation(tenantId, employeeId, period),
      this.resolveUnpaidFraction(tenantId, employeeId, period),
      this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId, year: lastWorkingDay.getUTCFullYear() },
        include: { policy: true },
      }),
    ]);

    const baseSalary = Number(emp.baseSalary);
    const encashableDays = balances
      .filter((b) => /annual/i.test(`${b.policy.name} ${b.policy.code}`))
      .reduce((sum, b) => sum + Math.max(0, Number(b.entitled) + Number(b.carried) - Number(b.used) - Number(b.pending)), 0);
    const leaveEncashment = Math.round((baseSalary / 30) * encashableDays);

    // Instalments due after the exit month would never be collected by payroll, so they are recovered here.
    const future = await this.prisma.compensationItem.findMany({
      where: { tenantId, employeeId, sourceType: 'LoanRequest', startPeriod: { gt: period } },
      select: { amount: true },
    });
    const loanRecovery = future.reduce((sum, i) => sum + Number(i.amount), 0);

    const unpaidFraction = Math.min(1, absentFraction + afterExitFraction);
    const calc = engine.calculate(baseSalary, {
      rules,
      taxableEarnings: comp.taxableEarnings + leaveEncashment,
      postTaxDeductions: comp.postTaxDeductions + loanRecovery,
      postTaxAdditions: comp.reimbursements,
      unpaidFraction,
    });

    return {
      period,
      lastWorkingDay: lastWorkingDay.toISOString().slice(0, 10),
      baseSalary,
      workedDays,
      daysInMonth,
      leaveEncashmentDays: encashableDays,
      leaveEncashmentAmount: leaveEncashment,
      otherEarnings: comp.taxableEarnings,
      recoveries: comp.postTaxDeductions + loanRecovery,
      loanRecovery,
      reimbursements: comp.reimbursements,
      gross: calc.gross,
      tax: calc.tax,
      eobi: calc.eobiAmount ?? 0,
      pf: calc.pfAmount ?? 0,
      net: calc.net,
      ruleSetId: rules?.ruleSetId ?? null,
      // Gratuity and notice-period pay/recovery are not modelled. Loan instalments still due are recovered above.
      validated: false,
      notes: [
        'Draft figure: gratuity and notice-period shortfall/recovery are not calculated.',
        ...(loanRecovery > 0 ? [`Includes recovery of ${loanRecovery} in loan/advance instalments that were still to be deducted.`] : []),
        'Tax is computed on this month\'s pro-rated earnings using the standard monthly method.',
      ],
    };
  }

  /**
   * Called when an employee's exit is signed off: future loan instalments were recovered (or written off) in
   * the final settlement, so they must not be deducted again; approved claims were paid in the settlement.
   */
  async closeOutForExit(tenantId: string, employeeId: string, lastWorkingDay: Date) {
    const period = lastWorkingDay.toISOString().slice(0, 7);
    await this.prisma.$transaction([
      this.prisma.compensationItem.deleteMany({
        where: { tenantId, employeeId, sourceType: 'LoanRequest', startPeriod: { gt: period } },
      }),
      this.prisma.loanRequest.updateMany({
        where: { tenantId, employeeId, status: 'APPROVED' },
        data: { status: 'COMPLETED' },
      }),
      this.prisma.expenseClaim.updateMany({
        where: { tenantId, employeeId, status: 'APPROVED' },
        data: { status: 'REIMBURSED', reimbursedAt: new Date(), reimbursedInPeriod: `settlement:${period}` },
      }),
    ]);
  }

  // ── Payroll run lifecycle: DRAFT -> REVIEW -> APPROVED -> LOCKED ───────
  async createPayrollRun(tenantId: string, period: string, preparedByUserId: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('period must look like 2026-09');
    const existing = await this.prisma.payrollRun.findUnique({
      where: { tenantId_period: { tenantId, period } },
    });
    if (existing) throw new BadRequestException('Payroll run already exists for this period');

    const run = await this.prisma.payrollRun.create({
      data: { tenantId, period, status: 'DRAFT', preparedByUserId },
    });
    const items = await this.populateRun(tenantId, run.id, period);
    return { run, items, summary: this.summarise(items) };
  }

  /** Recomputes every line of a DRAFT run from current data (new loans, claims, attendance, rules). */
  async recalculateDraftRun(tenantId: string, runId: string) {
    const run = await this.getRunOrThrow(tenantId, runId);
    if (run.status !== 'DRAFT') throw new BadRequestException('Only a draft run can be recalculated');
    await this.prisma.payrollItem.deleteMany({ where: { payrollRunId: runId } });
    const items = await this.populateRun(tenantId, runId, run.period);
    return { run, items, summary: this.summarise(items) };
  }

  private summarise(items: { grossSalary: unknown; netSalary: unknown }[]) {
    return {
      totalEmployees: items.length,
      totalGross: items.reduce((s, i) => s + Number(i.grossSalary), 0),
      totalNet: items.reduce((s, i) => s + Number(i.netSalary), 0),
    };
  }

  private async populateRun(tenantId: string, runId: string, period: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', baseSalary: { not: null } },
    });
    const engine = await this.engineFactory.getEngine(tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    const country = tenant?.currency === 'USD' ? 'US' : 'PK';
    const rules = await this.resolveRules(country, period);

    const items: Awaited<ReturnType<typeof this.prisma.payrollItem.create>>[] = [];
    for (const emp of employees) {
      const [{ taxableEarnings, postTaxDeductions, reimbursements, claimIds }, unpaidFraction] = await Promise.all([
        this.resolveCompensation(tenantId, emp.id, period),
        this.resolveUnpaidFraction(tenantId, emp.id, period),
      ]);

      const calc = engine.calculate(Number(emp.baseSalary), {
        rules, taxableEarnings, postTaxDeductions, postTaxAdditions: reimbursements, unpaidFraction,
      });

      const item = await this.prisma.payrollItem.create({
        data: {
          payrollRunId: runId,
          employeeId: emp.id,
          grossSalary: calc.gross,
          deductions: calc.deductions,
          netSalary: calc.net,
          taxAmount: calc.tax,
          eobiAmount: calc.eobiAmount ?? 0,
          pfAmount: calc.pfAmount ?? 0,
          // The claims folded into this line are recorded so locking marks exactly these as paid.
          breakdown: { ...calc.breakdown, reimbursedClaimIds: claimIds } as any,
        },
      });
      items.push(item);
    }
    return items;
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

    const items = await this.prisma.payrollItem.findMany({ where: { payrollRunId: runId }, select: { breakdown: true } });
    const claimIds = items.flatMap((i) => ((i.breakdown as any)?.reimbursedClaimIds as string[] | undefined) ?? []);
    const [locked] = await this.prisma.$transaction([
      this.prisma.payrollRun.update({ where: { id: runId }, data: { status: 'LOCKED', lockedAt: new Date() } }),
      this.prisma.expenseClaim.updateMany({
        where: { id: { in: claimIds }, tenantId, status: 'APPROVED' },
        data: { status: 'REIMBURSED', reimbursedAt: new Date(), reimbursedInPeriod: run.period },
      }),
    ]);
    return locked;
  }

  /** Controlled reopen: requires a reason, always audited via the run's own reopened* fields. */
  async reopenPayrollRun(tenantId: string, runId: string, operatorId: string, reason: string) {
    const run = await this.getRunOrThrow(tenantId, runId);
    if (run.status !== 'LOCKED') throw new BadRequestException('Only a locked run can be reopened');
    if (!reason?.trim()) throw new BadRequestException('A reason is required to reopen a locked payroll run');

    // Claims paid out by this run go back to "approved" so the recalculated draft pays them again.
    const [reopened] = await this.prisma.$transaction([
      this.prisma.payrollRun.update({
        where: { id: runId },
        data: { status: 'DRAFT', reopenedByUserId: operatorId, reopenedAt: new Date(), reopenReason: reason },
      }),
      this.prisma.expenseClaim.updateMany({
        where: { tenantId, status: 'REIMBURSED', reimbursedInPeriod: run.period },
        data: { status: 'APPROVED', reimbursedAt: null, reimbursedInPeriod: null },
      }),
    ]);
    return reopened;
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

  private assertDisbursable(run: { status: string }, what: string) {
    if (run.status !== 'APPROVED' && run.status !== 'LOCKED') {
      throw new BadRequestException(`${what} can only be produced for an approved or locked payroll run`);
    }
  }

  /** Validated bank file: bad rows are excluded and reported, never shipped. See bank-file.ts. */
  generateBankFile(run: Awaited<ReturnType<typeof this.getPayrollRun>>, bank: string) {
    this.assertDisbursable(run, 'A bank file');
    return buildBankFile(run.items, run.period, bank);
  }

  /** Balanced payroll journal CSV for QuickBooks import; recorded in the integration's sync log. */
  async exportJournal(tenantId: string, runId: string) {
    const run = await this.getPayrollRun(tenantId, runId);
    this.assertDisbursable(run, 'A journal export');

    const integration = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'quickbooks' } },
    });
    if (!integration || integration.status !== 'connected') {
      throw new BadRequestException('QuickBooks is not connected — connect it in the Marketplace first');
    }

    const startedAt = new Date();
    const accounts = ((integration.config as any)?.accounts ?? {}) as Record<string, string>;
    const journal = buildJournal(run.items, run.period, accounts);
    await this.syncLogs.record({
      tenantId,
      provider: 'quickbooks',
      direction: 'OUTBOUND',
      processed: run.items.length,
      failed: journal.balanced ? 0 : run.items.length,
      startedAt,
      message: journal.balanced
        ? `Exported journal ${journal.journalNo} (${journal.rows} lines, gross ${journal.totals.gross})`
        : `Journal ${journal.journalNo} did not balance — not usable`,
      details: { period: run.period, totals: journal.totals },
    });
    return {
      filename: `${journal.journalNo}.csv`,
      contentType: 'text/csv',
      content: journal.content,
      balanced: journal.balanced,
      totals: journal.totals,
    };
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
