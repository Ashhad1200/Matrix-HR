import { PrismaService } from '../prisma/prisma.service';

type Db = Pick<PrismaService, 'leavePolicy' | 'leaveBalance' | 'employee'>;

const dec = (n: unknown) => Number(n ?? 0);

/** Year-end carry-forward: what is left of last year's entitlement, capped by the policy's carryForwardMax (none = nothing carries). */
export function carryOver(prev: { entitled: unknown; carried: unknown; used: unknown; pending: unknown } | undefined, max: unknown): number {
  if (!prev) return 0;
  const left = dec(prev.entitled) + dec(prev.carried) - dec(prev.used) - dec(prev.pending);
  const cap = max == null ? 0 : dec(max);
  return Math.max(0, Math.min(left, cap));
}

/** Policies that apply to an employee (a gender-restricted policy, e.g. maternity, is skipped for everyone else). */
function applies(policy: { genderRestriction: string | null }, employee: { gender: string | null }) {
  if (!policy.genderRestriction) return true;
  return !!employee.gender && employee.gender.toLowerCase() === policy.genderRestriction.toLowerCase();
}

/**
 * Makes sure each of these employees has a balance row for every active policy for `year`: entitlement = the policy's yearly
 * days, plus any carry-forward from the previous year. Rows that already exist are never touched, and concurrent callers are
 * safe (skipDuplicates on the unique employee/policy/year key). This is what makes leave limits actually apply.
 */
export async function ensureBalances(db: Db, tenantId: string, year: number, employeeIds?: string[], policyIds?: string[]): Promise<number> {
  const [policies, employees] = await Promise.all([
    db.leavePolicy.findMany({ where: { tenantId, isActive: true, ...(policyIds ? { id: { in: policyIds } } : {}) } }),
    db.employee.findMany({ where: { tenantId, status: 'ACTIVE', ...(employeeIds ? { id: { in: employeeIds } } : {}) }, select: { id: true, gender: true } }),
  ]);
  if (!policies.length || !employees.length) return 0;
  const [existing, previous] = await Promise.all([
    db.leaveBalance.findMany({ where: { tenantId, year, employeeId: { in: employees.map((e) => e.id) } }, select: { employeeId: true, policyId: true } }),
    db.leaveBalance.findMany({ where: { tenantId, year: year - 1, employeeId: { in: employees.map((e) => e.id) } } }),
  ]);
  const have = new Set(existing.map((b) => `${b.employeeId}:${b.policyId}`));
  const prev = new Map(previous.map((b) => [`${b.employeeId}:${b.policyId}`, b]));
  const rows: { tenantId: string; employeeId: string; policyId: string; year: number; entitled: unknown; carried: number }[] = [];
  for (const e of employees) {
    for (const p of policies) {
      const k = `${e.id}:${p.id}`;
      if (have.has(k) || !applies(p, e)) continue;
      rows.push({ tenantId, employeeId: e.id, policyId: p.id, year, entitled: p.daysPerYear, carried: carryOver(prev.get(k), p.carryForwardMax) });
    }
  }
  if (!rows.length) return 0;
  const r = await db.leaveBalance.createMany({ data: rows as any, skipDuplicates: true });
  return r.count;
}
