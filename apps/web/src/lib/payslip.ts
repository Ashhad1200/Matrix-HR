import { PAKISTAN_TAX_SLABS_2025, EOBI_EMPLOYEE_RATE, EOBI_EMPLOYER_RATE, EOBI_MIN_WAGE } from '@matrixhr/shared';

/**
 * Browser copy of PkPayrollEngine.calculate (apps/api/src/payroll/engines/pk-payroll.engine.ts), using the same
 * default rule set from @matrixhr/shared, so the landing-page payslip shows exactly what a run would produce.
 * If the engine changes, change this too.
 */
export const PF_RATE = 0.08;

export type PayslipInputs = {
  base: number;
  /** Unpaid days this period; the API divides by days in the month. */
  unpaidDays: number;
  daysInMonth: number;
  /** Allowances, bonuses and arrears: taxable. */
  taxableEarnings: number;
  /** Loan and advance instalments: recovered after tax. */
  recoveries: number;
  /** Approved expense claims: paid on top of net, never taxed. */
  reimbursements: number;
};

export type Payslip = {
  base: number;
  unpaidDeduction: number;
  taxableEarnings: number;
  gross: number;
  tax: number;
  eobi: number;
  eobiEmployer: number;
  pf: number;
  pfEmployer: number;
  recoveries: number;
  reimbursements: number;
  net: number;
};

function monthlyTax(annual: number) {
  let tax = 0;
  let remaining = annual;
  for (const slab of PAKISTAN_TAX_SLABS_2025) {
    const slabMax = slab.max === Infinity ? remaining : slab.max;
    const taxable = Math.min(remaining, slabMax - slab.min + 1);
    if (taxable <= 0) break;
    tax += taxable * slab.rate;
    remaining -= taxable;
    if (remaining <= 0) break;
  }
  return Math.round(tax / 12);
}

export function calculatePayslip(i: PayslipInputs): Payslip {
  const unpaidFraction = Math.min(Math.max(i.unpaidDays / i.daysInMonth, 0), 1);
  const baseAfterUnpaid = i.base * (1 - unpaidFraction);
  const gross = baseAfterUnpaid + i.taxableEarnings;
  const tax = monthlyTax(gross * 12);
  const eobiBase = Math.max(gross, EOBI_MIN_WAGE);
  const eobi = Math.round(eobiBase * EOBI_EMPLOYEE_RATE);
  const eobiEmployer = Math.round(eobiBase * EOBI_EMPLOYER_RATE);
  const pf = Math.round(gross * PF_RATE);
  const net = gross - (tax + eobi + pf + i.recoveries) + i.reimbursements;
  return {
    base: i.base,
    unpaidDeduction: i.base * unpaidFraction,
    taxableEarnings: i.taxableEarnings,
    gross,
    tax,
    eobi,
    eobiEmployer,
    pf,
    pfEmployer: pf,
    recoveries: i.recoveries,
    reimbursements: i.reimbursements,
    net,
  };
}

const pkr = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });
export const formatPkr = (n: number) => pkr.format(Math.round(n));
