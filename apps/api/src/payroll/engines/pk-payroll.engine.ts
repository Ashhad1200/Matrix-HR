import {
  PAKISTAN_TAX_SLABS_2025,
  EOBI_EMPLOYEE_RATE,
  EOBI_EMPLOYER_RATE,
  EOBI_MIN_WAGE,
} from '@matrixhr/shared';
import { PayrollEngine, PayrollBreakdown } from './payroll-engine.interface';

export class PkPayrollEngine implements PayrollEngine {
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

  calculate(grossSalary: number): PayrollBreakdown {
    const gross = Number(grossSalary);
    const tax = this.calculateMonthlyTax(gross * 12);
    const eobi = this.calculateEobi(gross);
    const pf = this.calculatePf(gross);
    const deductions = tax + eobi.employee + pf.employee;
    const net = gross - deductions;

    return {
      gross,
      tax,
      eobiAmount: eobi.employee,
      pfAmount: pf.employee,
      deductions,
      net,
      breakdown: {
        gross,
        tax,
        eobiEmployee: eobi.employee,
        eobiEmployer: eobi.employer,
        pfEmployee: pf.employee,
        pfEmployer: pf.employer,
        net,
        country: 'PK',
      },
    };
  }
}
