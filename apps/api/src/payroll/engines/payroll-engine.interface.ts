export interface PayrollBreakdown {
  gross: number;
  tax: number;
  eobiAmount?: number;
  pfAmount?: number;
  socialSecurity?: number;
  medicare?: number;
  deductions: number;
  net: number;
  breakdown: Record<string, unknown>;
}

/** Resolved effective-dated compliance rates (see PayrollRuleSet). */
export interface PayrollRules {
  taxSlabs: readonly { min: number; max: number; rate: number }[];
  eobiEmployeeRate: number;
  eobiEmployerRate: number;
  eobiMinWage: number;
  pfRate: number;
  ruleSetId?: string;
}

/** Real inputs beyond base salary — attendance, leave, and configured
 * earnings/deductions (ENGINEERING_ROADMAP.md Phase 2). All optional so the
 * engine remains directly unit-testable with just a gross salary. */
export interface PayrollCalcContext {
  rules?: PayrollRules;
  /** Taxable additions for the period: allowances, bonuses, arrears. */
  taxableEarnings?: number;
  /** Post-tax deductions for the period: loans, advances, other deductions. */
  postTaxDeductions?: number;
  /** Non-taxable additions paid on top of net pay: approved expense reimbursements. Not part of gross. */
  postTaxAdditions?: number;
  /** 0..1 fraction of the period that was unpaid (absence/half-day), reduces base pay pro-rata. */
  unpaidFraction?: number;
}

export interface PayrollEngine {
  calculate(grossSalary: number, context?: PayrollCalcContext): PayrollBreakdown;
}
