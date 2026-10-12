import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthService } from '../auth/auth.service';
import { CreateTenantDto, CreatePlanDto } from './dto';

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
    private auth: AuthService,
  ) {}

  private async audit(operatorUserId: string, action: string, targetType: string, targetId: string, detail?: unknown) {
    await this.prisma.platformAuditLog.create({
      data: { operatorUserId, action, targetType, targetId, detail: detail as any },
    });
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        subscription: { include: { planVersion: { include: { plan: true } } } },
        _count: { select: { employees: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      status: t.status,
      employeeCount: t._count.employees,
      userCount: t._count.users,
      plan: t.subscription?.planVersion.plan.code ?? null,
      subscriptionStatus: t.subscription?.status ?? 'unsubscribed',
      createdAt: t.createdAt,
    }));
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            planVersion: { include: { plan: true, entitlements: true } },
            overrides: { orderBy: { createdAt: 'desc' } },
          },
        },
        _count: { select: { employees: true, users: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const entitlements = await this.entitlements.resolve(id);
    return { ...tenant, resolvedEntitlements: entitlements };
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      include: { versions: { where: { isCurrent: true }, include: { entitlements: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Creates a new org (tenant) with its first COMPANY_ADMIN, the same defaults a public signup gets
  // (leave policies, a shift), optionally starting it on a plan. When adminPassword is omitted a strong
  // one is generated and returned once — it is never stored or logged in plain text.
  async createTenant(operatorUserId: string, dto: CreateTenantDto) {
    const generatedPassword = dto.adminPassword ?? `Op3${randomBytes(9).toString('hex')}`;
    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    const tenant = await this.auth.provisionTenant({
      companyName: dto.companyName,
      subdomain: dto.subdomain,
      email: dto.adminEmail,
      passwordHash,
    });

    if (dto.planCode) {
      await this.assignPlan(operatorUserId, tenant.id, dto.planCode);
    }

    await this.audit(operatorUserId, 'CREATE_TENANT', 'Tenant', tenant.id, {
      name: tenant.name,
      subdomain: tenant.subdomain,
      planCode: dto.planCode ?? null,
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      admin: { email: dto.adminEmail, ...(dto.adminPassword ? {} : { generatedPassword }) },
    };
  }

  async createPlan(operatorUserId: string, dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Plan code "${dto.code}" already exists`);

    const plan = await this.prisma.plan.create({
      data: {
        code: dto.code,
        name: dto.name,
        versions: {
          create: {
            version: 1,
            isCurrent: true,
            pricePkrMonthly: dto.pricePkrMonthly,
            includedEmployees: dto.includedEmployees ?? 0,
            perEmployeePricePkr: dto.perEmployeePricePkr,
            entitlements: dto.entitlements?.length
              ? { create: dto.entitlements.map((e) => ({ featureKey: e.featureKey, enabled: e.enabled ?? true, limit: e.limit })) }
              : undefined,
          },
        },
      },
      include: { versions: { include: { entitlements: true } } },
    });

    await this.audit(operatorUserId, 'CREATE_PLAN', 'Plan', plan.id, { code: plan.code, name: plan.name });
    return plan;
  }

  async assignPlan(operatorUserId: string, tenantId: string, planCode: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const planVersion = await this.prisma.planVersion.findFirst({
      where: { plan: { code: planCode }, isCurrent: true },
    });
    if (!planVersion) throw new BadRequestException(`Unknown or inactive plan: ${planCode}`);

    const subscription = await this.prisma.subscription.upsert({
      where: { tenantId },
      create: { tenantId, planVersionId: planVersion.id, status: 'active' },
      update: { planVersionId: planVersion.id },
      include: { planVersion: { include: { plan: true } } },
    });

    await this.audit(operatorUserId, 'ASSIGN_PLAN', 'Tenant', tenantId, { planCode });
    return subscription;
  }

  async setSubscriptionStatus(operatorUserId: string, tenantId: string, status: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) throw new NotFoundException('Tenant has no subscription yet — assign a plan first');

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: { status, ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}) },
    });

    // "Suspended" is the operator's hard stop: it blocks every sign-in and API call of that company (JwtStrategy checks
    // Tenant.status on each request). Any other status lifts a suspension, so it is fully reversible.
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
    if (status === 'suspended' && tenant?.status === 'ACTIVE') await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } });
    else if (status !== 'suspended' && tenant?.status === 'SUSPENDED') await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });

    await this.audit(operatorUserId, 'SET_SUBSCRIPTION_STATUS', 'Tenant', tenantId, { status });
    return updated;
  }

  async createOverride(
    operatorUserId: string,
    tenantId: string,
    dto: { featureKey: string; enabled?: boolean; limit?: number; reason: string; effectiveTo?: string },
  ) {
    const subscription = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) throw new NotFoundException('Tenant has no subscription yet — assign a plan first');

    const override = await this.prisma.entitlementOverride.create({
      data: {
        subscriptionId: subscription.id,
        featureKey: dto.featureKey,
        enabled: dto.enabled,
        limit: dto.limit,
        reason: dto.reason,
        createdByUserId: operatorUserId,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
    });

    await this.audit(operatorUserId, 'CREATE_OVERRIDE', 'Tenant', tenantId, dto);
    return override;
  }

  async deleteOverride(operatorUserId: string, tenantId: string, overrideId: string) {
    const override = await this.prisma.entitlementOverride.findFirst({
      where: { id: overrideId, subscription: { tenantId } },
    });
    if (!override) throw new NotFoundException('Override not found');

    await this.prisma.entitlementOverride.delete({ where: { id: overrideId } });
    await this.audit(operatorUserId, 'DELETE_OVERRIDE', 'Tenant', tenantId, { overrideId, featureKey: override.featureKey });
    return { deleted: true };
  }

  async listAuditLog(limit = 100) {
    return this.prisma.platformAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
