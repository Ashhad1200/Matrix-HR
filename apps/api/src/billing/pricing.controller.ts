import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { singleCompanyMode } from '../common/deployment';
import { brand } from '../common/brand';

/** Public price list (both currencies) for the marketing page. Read from the database so backoffice edits show up. */
@Controller('pricing')
export class PricingController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async get() {
    if (singleCompanyMode()) throw new NotFoundException('Not found'); // a single-company install shows no prices
    const [versions, packs] = await Promise.all([
      this.prisma.planVersion.findMany({ where: { isCurrent: true, offeredToNew: true, currency: 'USD', priceMonthly: { not: null }, plan: { isActive: true } }, include: { plan: true }, orderBy: { priceMonthly: 'asc' } }),
      this.prisma.creditPack.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } }),
    ]);
    const n = (d: unknown) => (d == null ? null : Number(d));
    return {
      currencies: brand().currencies,
      plans: versions.map((v) => ({
        code: v.plan.code, name: v.plan.name, maxEmployees: v.maxEmployees, maxAdminUsers: v.maxAdminUsers, aiCreditsMonthly: v.aiCreditsMonthly,
        USD: { monthly: n(v.priceMonthly), yearly: n(v.priceYearly), overagePerEmployee: n(v.overagePerEmployee) },
        PKR: { monthly: n(v.priceMonthlyPkr), yearly: n(v.priceYearlyPkr), overagePerEmployee: n(v.overagePerEmployeePkr) },
      })),
      creditPacks: packs.map((p) => ({ code: p.code, name: p.name, credits: p.credits, USD: n(p.price), PKR: n(p.pricePkr) })),
    };
  }
}
