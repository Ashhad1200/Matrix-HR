import { PrismaClient } from '@prisma/client';
import { USD_PLAN_CATALOG, AI_CREDIT_PACKS } from '@matrixhr/shared';
import { FEATURES, GROWTH, PRO, STARTER } from './seed-commercial';

/**
 * The USD catalog: Starter / Growth / Business, AI credit packs, and the singleton settings rows.
 *
 * NON-DESTRUCTIVE and idempotent. It only ever INSERTS what is missing:
 *  - existing tenants keep the plan version they are on, untouched (their PKR v1 versions stay as they are);
 *  - old PKR versions and the pro/enterprise plans stay assignable by an operator but are not offered to new signups
 *    (PlanVersion.offeredToNew defaults to false for every pre-existing row);
 *  - re-running never overwrites prices an operator has since edited.
 *
 * Run it after the migration:  DATABASE_URL=... pnpm --filter @matrixhr/database exec tsx prisma/seed-usd-catalog.ts
 */
const AI = 'ai.ask';
const FEATURES_BY_PLAN: Record<string, string[]> = {
  starter: [...STARTER, AI],
  growth: [...GROWTH, AI],
  // Business: everything in Growth plus the Pro feature set. SSO, EOR and marketplace stay Enterprise-only.
  business: [...PRO, AI],
};
const CATALOG = USD_PLAN_CATALOG.map((c) => ({ ...c, credits: c.aiCreditsMonthly, overage: c.overagePerEmployee, features: FEATURES_BY_PLAN[c.code] }));
const PACKS = AI_CREDIT_PACKS;

export async function seedUsdCatalog(prisma: PrismaClient, log: (m: string) => void = () => {}) {
  for (const f of FEATURES) await prisma.productFeature.upsert({ where: { key: f.key }, update: {}, create: f });

  for (const c of CATALOG) {
    const plan = await prisma.plan.upsert({ where: { code: c.code }, update: {}, create: { code: c.code, name: c.name } });
    const versions = await prisma.planVersion.findMany({ where: { planId: plan.id }, orderBy: { version: 'desc' } });
    if (versions.some((v) => v.currency === 'USD')) { log(`${c.code}: USD version already present, left as is`); continue; }
    const next = (versions[0]?.version ?? 0) + 1;
    await prisma.$transaction([
      // New signups and operators get the USD version from now on; existing subscriptions still point at their own version.
      prisma.planVersion.updateMany({ where: { planId: plan.id }, data: { isCurrent: false } }),
      prisma.planVersion.create({
        data: {
          planId: plan.id, version: next, isCurrent: true, offeredToNew: true, currency: 'USD',
          priceMonthly: c.monthly, priceYearly: c.yearly, priceMonthlyPkr: c.monthlyPkr, priceYearlyPkr: c.yearlyPkr, overagePerEmployeePkr: c.overagePerEmployeePkr ?? undefined, aiCreditsMonthly: c.credits, maxEmployees: c.maxEmployees, maxAdminUsers: c.maxAdminUsers,
          overagePerEmployee: c.overage ?? undefined,
          entitlements: { create: [...new Set(c.features)].map((featureKey) => ({ featureKey, enabled: true })) },
        },
      }),
    ]);
    log(`${c.code}: created USD version ${next}`);
  }

  for (const p of PACKS) {
    const exists = await prisma.creditPack.findUnique({ where: { code: p.code } });
    if (!exists) { await prisma.creditPack.create({ data: { ...p, currency: 'USD' } }); log(`pack ${p.code}: created`); }
  }
  await prisma.billingSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
  await prisma.aiSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } }); // master switch defaults to OFF
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedUsdCatalog(prisma, (m) => console.log(m))
    .then(() => console.log('USD catalog ready'))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
