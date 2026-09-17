import { PrismaClient } from '@prisma/client';
import { PAKISTAN_TAX_SLABS_2025, EOBI_EMPLOYEE_RATE, EOBI_EMPLOYER_RATE, EOBI_MIN_WAGE } from '@matrixhr/shared';

/** Seeds the current hardcoded PK rates as the first effective-dated rule
 * set, so behavior is unchanged but now versioned/queryable instead of
 * baked into engine code. See ENGINEERING_ROADMAP.md Phase 2. */
export async function seedPayrollRules(prisma: PrismaClient) {
  const existing = await prisma.payrollRuleSet.findFirst({
    where: { country: 'PK', fiscalYear: 2025, isActive: true },
  });
  if (existing) return;

  await prisma.payrollRuleSet.create({
    data: {
      country: 'PK',
      fiscalYear: 2025,
      effectiveFrom: new Date('2025-07-01'),
      taxSlabs: PAKISTAN_TAX_SLABS_2025.map((s) => ({
        min: s.min,
        max: s.max === Infinity ? null : s.max,
        rate: s.rate,
      })),
      eobiEmployeeRate: EOBI_EMPLOYEE_RATE,
      eobiEmployerRate: EOBI_EMPLOYER_RATE,
      eobiMinWage: EOBI_MIN_WAGE,
      pfRate: 0.08,
      isActive: true,
    },
  });
}
