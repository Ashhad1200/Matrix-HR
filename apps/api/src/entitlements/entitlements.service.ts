import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedEntitlements = {
  planCode: string;
  status: string;
  features: Record<string, { enabled: boolean; limit: number | null }>;
};

// Tenants without a Subscription row yet (pre-Phase-1 data, or a fresh signup
// before a plan is assigned) get this safe default — mirrors "nothing was
// gated before" so existing tenants don't silently lose access on deploy.
const UNSUBSCRIBED_DEFAULT: ResolvedEntitlements = {
  planCode: 'none',
  status: 'unsubscribed',
  features: {},
};

@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  async resolve(tenantId: string): Promise<ResolvedEntitlements> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        planVersion: { include: { entitlements: true, plan: true } },
        overrides: true,
      },
    });

    if (!subscription) return UNSUBSCRIBED_DEFAULT;

    const features: Record<string, { enabled: boolean; limit: number | null }> = {};
    for (const ent of subscription.planVersion.entitlements) {
      features[ent.featureKey] = { enabled: ent.enabled, limit: ent.limit ?? null };
    }

    const now = new Date();
    for (const ov of subscription.overrides) {
      if (ov.effectiveFrom > now) continue;
      if (ov.effectiveTo && ov.effectiveTo < now) continue;
      const existing = features[ov.featureKey] ?? { enabled: true, limit: null };
      features[ov.featureKey] = {
        enabled: ov.enabled ?? existing.enabled,
        limit: ov.limit ?? existing.limit,
      };
    }

    return { planCode: subscription.planVersion.plan.code, status: subscription.status, features };
  }

  async hasFeature(tenantId: string, featureKey: string): Promise<boolean> {
    const { status, features } = await this.resolve(tenantId);
    if (status !== 'active' && status !== 'trialing') return false;
    return features[featureKey]?.enabled ?? false;
  }

  async recordUsage(tenantId: string, metricKey: string, quantity = 1) {
    // Fire-and-forget by design: usage metering must never block or fail the
    // action it's measuring. A lost usage event is a minor billing gap, not
    // a user-facing failure.
    await this.prisma.usageEvent.create({ data: { tenantId, metricKey, quantity } }).catch(() => {});
  }
}
