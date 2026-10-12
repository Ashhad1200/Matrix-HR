export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  HR_MANAGER: 'HR_MANAGER',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const PAKISTAN_TAX_SLABS_2025 = [
  { min: 0, max: 600000, rate: 0 },
  { min: 600001, max: 1200000, rate: 0.025 },
  { min: 1200001, max: 2200000, rate: 0.125 },
  { min: 2200001, max: 3200000, rate: 0.2 },
  { min: 3200001, max: 4100000, rate: 0.25 },
  { min: 4100001, max: Infinity, rate: 0.35 },
] as const;

export const EOBI_EMPLOYEE_RATE = 0.01;
export const EOBI_EMPLOYER_RATE = 0.05;
export const EOBI_MIN_WAGE = 37000;

export const DEFAULT_LEAVE_POLICIES = [
  { code: 'annual', name: 'Annual Leave', daysPerYear: 14 },
  { code: 'casual', name: 'Casual Leave', daysPerYear: 10 },
  { code: 'sick', name: 'Sick Leave', daysPerYear: 8 },
] as const;

/**
 * The public USD catalog. The landing page, the catalog seed (packages/database/prisma/seed-usd-catalog.ts) and the
 * billing tests all read this one list, so the price shown on the site is the price a customer is quoted.
 * Operators can later edit prices in the backoffice; the live database then wins and this list is only the starting point.
 */
export const USD_PLAN_CATALOG = [
  { code: 'starter', name: 'Starter', monthly: 25, yearly: 250, monthlyPkr: 6999, yearlyPkr: 69990, maxEmployees: 25, maxAdminUsers: 2, aiCreditsMonthly: 150, overagePerEmployee: null, overagePerEmployeePkr: null },
  { code: 'growth', name: 'Growth', monthly: 69, yearly: 690, monthlyPkr: 18999, yearlyPkr: 189990, maxEmployees: 100, maxAdminUsers: 5, aiCreditsMonthly: 500, overagePerEmployee: null, overagePerEmployeePkr: null },
  { code: 'business', name: 'Business', monthly: 149, yearly: 1490, monthlyPkr: 39999, yearlyPkr: 399990, maxEmployees: 300, maxAdminUsers: 15, aiCreditsMonthly: 1500, overagePerEmployee: 0.5, overagePerEmployeePkr: 140 },
] as const;

export const AI_CREDIT_PACKS = [
  { code: 'small', name: 'Small', credits: 1000, price: 10, pricePkr: 2799 },
  { code: 'medium', name: 'Medium', credits: 5000, price: 45, pricePkr: 12499 },
  { code: 'large', name: 'Large', credits: 15000, price: 120, pricePkr: 32999 },
] as const;

export const TRIAL_DAYS = 30;
export const TRIAL_CREDITS = 100;
