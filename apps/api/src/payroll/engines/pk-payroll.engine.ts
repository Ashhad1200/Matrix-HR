import {
  PAKISTAN_TAX_SLABS_2025,
  EOBI_EMPLOYEE_RATE,
  EOBI_EMPLOYER_RATE,
  EOBI_MIN_WAGE,
} from '@matrixhr/shared';
import { PayrollEngine, PayrollBreakdown, PayrollCalcContext, PayrollRules } from './payroll-engine.interface';

const DEFAULT_RULES: PayrollRules = {
  taxSlabs: PAKISTAN_TAX_SLABS_2025,
  eobiEmployeeRate: EOBI_EMPLOYEE_RATE,
  eobiEmployerRate: EOBI_EMPLOYER_RATE,
  eobiMinWage: EOBI_MIN_WAGE,
  pfRate: 0.08,
};

export class PkPayrollEngine implements PayrollEngine {
  calculateMonthlyTax(annualSalary: number, rules: PayrollRules = DEFAULT_RULES): number {
    let tax = 0;
    let remaining = annualSalary;

    for (const slab of rules.taxSlabs) {
      const slabMax = slab.max === Infinity ? remaining : slab.max;
      const taxableInSlab = Math.min(remaining, slabMax - slab.min + 1);
      if (taxableInSlab <= 0) break;
      tax += taxableInSlab * slab.rate;
      remaining -= taxableInSlab;
      if (remaining <= 0) break;
    }

    return Math.round(tax / 12);
  }

  calculateEobi(grossSalary: number, rules: PayrollRules = DEFAULT_RULES) {
    const base = Math.max(Number(grossSalary), rules.eobiMinWage);
    return {
      employee: Math.round(base * rules.eobiEmployeeRate),
      employer: Math.round(base * rules.eobiEmployerRate),
    };
  }

  calculatePf(grossSalary: number, rules: PayrollRules = DEFAULT_RULES) {
    const amount = Math.round(Number(grossSalary) * rules.pfRate);
    return { employee: amount, employer: amount };
  }

  calculate(grossSalary: number, context: PayrollCalcContext = {}): PayrollBreakdown {
    const rules = context.rules ?? DEFAULT_RULES;
    const unpaidFraction = Math.min(Math.max(context.unpaidFraction ?? 0, 0), 1);
    const taxableEarnings = context.taxableEarnings ?? 0;
    const postTaxDeductions = context.postTaxDeductions ?? 0;
    const postTaxAdditions = context.postTaxAdditions ?? 0;

    const baseAfterUnpaid = Number(grossSalary) * (1 - unpaidFraction);
    const gross = baseAfterUnpaid + taxableEarnings;

    const tax = this.calculateMonthlyTax(gross * 12, rules);
    const eobi = this.calculateEobi(gross, rules);
    const pf = this.calculatePf(gross, rules);
    const deductions = tax + eobi.employee + pf.employee + postTaxDeductions;
    // Reimbursements repay money the employee already spent, so they are neither taxed nor pensionable.
    const net = gross - deductions + postTaxAdditions;

    return {
      gross,
      tax,
      eobiAmount: eobi.employee,
      pfAmount: pf.employee,
      deductions,
      net,
      breakdown: {
        baseSalary: Number(grossSalary),
        unpaidFraction,
        unpaidDeduction: Number(grossSalary) * unpaidFraction,
        taxableEarnings,
        gross,
        tax,
        eobiEmployee: eobi.employee,
        eobiEmployer: eobi.employer,
        pfEmployee: pf.employee,
        pfEmployer: pf.employer,
        postTaxDeductions,
        reimbursements: postTaxAdditions,
        net,
        country: 'PK',
        ruleSetId: rules.ruleSetId ?? 'default-hardcoded',
      },
    };
  }
}
