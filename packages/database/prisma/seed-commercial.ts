import { PrismaClient } from '@prisma/client';

const FEATURES: { key: string; name: string }[] = [
  { key: 'employees.core', name: 'Employee Records' },
  { key: 'leave.manage', name: 'Leave Management' },
  { key: 'attendance.manage', name: 'Attendance & Time Clock' },
  { key: 'self_service.basic', name: 'Employee Self-Service' },
  { key: 'timesheets.manage', name: 'Timesheets & Projects' },
  { key: 'payroll.run', name: 'Payroll' },
  { key: 'recruitment.manage', name: 'Recruitment / ATS' },
  { key: 'onboarding.manage', name: 'Onboarding' },
  { key: 'whatsapp.send', name: 'WhatsApp Messaging' },
  { key: 'performance.manage', name: 'Performance & Reviews' },
  { key: 'lms.manage', name: 'Learning Management' },
  { key: 'reports.advanced', name: 'Advanced Reporting' },
  { key: 'api.access', name: 'Public API Access' },
  { key: 'custom_fields.manage', name: 'Custom Fields' },
  { key: 'workflows.manage', name: 'Workflow Automation' },
  { key: 'ai.ask', name: 'Ask MatrixHR (AI)' },
  { key: 'sso.saml', name: 'Enterprise SSO' },
  { key: 'marketplace.connect', name: 'Marketplace Integrations' },
  { key: 'extensions.manage', name: 'Extensions' },
  { key: 'eor.quote', name: 'Global Hiring (EOR)' },
  { key: 'attendance.biometric', name: 'Biometric Attendance Devices' },
  { key: 'accounting.export', name: 'Accounting Export' },
];

const STARTER = ['employees.core', 'leave.manage', 'attendance.manage', 'self_service.basic', 'timesheets.manage'];
const GROWTH = [...STARTER, 'payroll.run', 'recruitment.manage', 'onboarding.manage', 'whatsapp.send', 'attendance.biometric', 'accounting.export'];
const PRO = [...GROWTH, 'performance.manage', 'lms.manage', 'reports.advanced', 'api.access', 'custom_fields.manage', 'workflows.manage'];
const ENTERPRISE = [...PRO, 'ai.ask', 'sso.saml', 'marketplace.connect', 'extensions.manage', 'eor.quote'];

const PLANS: { code: string; name: string; pricePkrMonthly: number | null; includedEmployees: number; perEmployeePricePkr: number | null; features: string[] }[] = [
  { code: 'starter', name: 'Starter', pricePkrMonthly: 5000, includedEmployees: 20, perEmployeePricePkr: 250, features: STARTER },
  { code: 'growth', name: 'Growth', pricePkrMonthly: 10000, includedEmployees: 20, perEmployeePricePkr: 500, features: GROWTH },
  { code: 'pro', name: 'Pro', pricePkrMonthly: 17000, includedEmployees: 20, perEmployeePricePkr: 850, features: PRO },
  { code: 'enterprise', name: 'Enterprise', pricePkrMonthly: null, includedEmployees: 0, perEmployeePricePkr: null, features: ENTERPRISE },
];

/** Seeds ProductFeature/Plan/PlanVersion/PlanEntitlement, then subscribes the
 * given tenant to Enterprise (every feature) so existing demo data and tests
 * keep working unmodified — see ENGINEERING_ROADMAP.md Phase 1. */
export async function seedCommercial(prisma: PrismaClient, tenantId: string) {
  for (const f of FEATURES) {
    await prisma.productFeature.upsert({ where: { key: f.key }, update: { name: f.name }, create: f });
  }

  const planVersionByCode: Record<string, string> = {};
  for (const p of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: { code: p.code, name: p.name },
    });

    const version = await prisma.planVersion.upsert({
      where: { planId_version: { planId: plan.id, version: 1 } },
      update: {
        pricePkrMonthly: p.pricePkrMonthly ?? undefined,
        includedEmployees: p.includedEmployees,
        perEmployeePricePkr: p.perEmployeePricePkr ?? undefined,
      },
      create: {
        planId: plan.id,
        version: 1,
        pricePkrMonthly: p.pricePkrMonthly ?? undefined,
        includedEmployees: p.includedEmployees,
        perEmployeePricePkr: p.perEmployeePricePkr ?? undefined,
      },
    });
    planVersionByCode[p.code] = version.id;

    for (const featureKey of p.features) {
      await prisma.planEntitlement.upsert({
        where: { planVersionId_featureKey: { planVersionId: version.id, featureKey } },
        update: { enabled: true },
        create: { planVersionId: version.id, featureKey, enabled: true },
      });
    }
  }

  await prisma.subscription.upsert({
    where: { tenantId },
    update: { planVersionId: planVersionByCode.enterprise, status: 'active' },
    create: { tenantId, planVersionId: planVersionByCode.enterprise, status: 'active' },
  });
}
