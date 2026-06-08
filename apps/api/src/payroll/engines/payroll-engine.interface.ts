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

export interface PayrollEngine {
  calculate(grossSalary: number): PayrollBreakdown;
}
