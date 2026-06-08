import { PayrollEngine, PayrollBreakdown } from './payroll-engine.interface';

const FEDERAL_TAX_BRACKETS_2025 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11601, max: 47150, rate: 0.12 },
  { min: 47151, max: 100525, rate: 0.22 },
  { min: 100526, max: 191950, rate: 0.24 },
  { min: 191951, max: 243725, rate: 0.32 },
  { min: 243726, max: 609350, rate: 0.35 },
  { min: 609351, max: Infinity, rate: 0.37 },
] as const;

const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_WAGE_BASE = 168600;
const MEDICARE_RATE = 0.0145;

export class UsPayrollEngine implements PayrollEngine {
  calculateFederalTax(annualSalary: number): number {
    let tax = 0;
    let remaining = annualSalary;

    for (const bracket of FEDERAL_TAX_BRACKETS_2025) {
      const bracketMax = bracket.max === Infinity ? remaining : bracket.max;
      const taxableInBracket = Math.min(remaining, bracketMax - bracket.min + 1);
      if (taxableInBracket <= 0) break;
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      if (remaining <= 0) break;
    }

    return Math.round(tax / 12);
  }

  calculate(grossSalary: number): PayrollBreakdown {
    const gross = Number(grossSalary);
    const annualGross = gross * 12;
    const tax = this.calculateFederalTax(annualGross);
    const socialSecurity = Math.round(Math.min(annualGross, SOCIAL_SECURITY_WAGE_BASE) / 12 * SOCIAL_SECURITY_RATE);
    const medicare = Math.round(gross * MEDICARE_RATE);
    const deductions = tax + socialSecurity + medicare;
    const net = gross - deductions;

    return {
      gross,
      tax,
      socialSecurity,
      medicare,
      deductions,
      net,
      breakdown: {
        gross,
        federalTax: tax,
        socialSecurity,
        medicare,
        net,
        country: 'US',
      },
    };
  }
}
