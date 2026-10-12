import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LAPSED_ALLOWED_PATH, computeLifecycle } from '../billing/lifecycle';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      passReqToCallback: true,
    });
  }

  async validate(req: { originalUrl?: string; url?: string }, payload: { sub: string; tenantId: string; role: string; tv?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true, employee: true },
    });

    if (!user || user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    // A password reset/change bumps tokenVersion, which kills every token minted before it.
    if ((payload.tv ?? 0) !== user.tokenVersion) throw new UnauthorizedException();

    await this.enforceBilling(req, user);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      tenant: user.tenant,
      employee: user.employee,
    };
  }

  /**
   * Lapsed tenants (period end + grace days passed, no open provisional window) may only reach auth, billing and health, so
   * they land on the billing-only screen instead of a dead end. Computed on every request from dates; a tenant with no
   * period end has no billing clock and is never blocked. The operator (SUPER_ADMIN) is never gated.
   */
  private async enforceBilling(req: { originalUrl?: string; url?: string }, user: { id: string; role: string; tenantId: string }) {
    if (user.role === 'SUPER_ADMIN') return;
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: user.tenantId }, select: { id: true, currentPeriodEnd: true } });
    if (!sub?.currentPeriodEnd) return;
    const path = req.originalUrl ?? req.url ?? '';
    if (LAPSED_ALLOWED_PATH.test(path)) return;
    const settings = await this.prisma.billingSettings.findUnique({ where: { id: 'singleton' }, select: { graceDays: true } });
    const grace = settings?.graceDays ?? 3;
    const early = computeLifecycle({ now: new Date(), periodEnd: sub.currentPeriodEnd, graceDays: grace });
    if (!early.blocked) return;
    const prov = await this.prisma.provisionalAccess.findUnique({ where: { subscriptionId_periodEnd: { subscriptionId: sub.id, periodEnd: sub.currentPeriodEnd } } });
    const life = computeLifecycle({ now: new Date(), periodEnd: sub.currentPeriodEnd, graceDays: grace, provisionalUntil: prov && !prov.revokedAt ? prov.until : null });
    if (life.blocked) {
      throw new ForbiddenException({ message: 'Your company\'s subscription has ended. Please renew from the Billing page.', error: 'Forbidden', code: 'BILLING_LAPSED' });
    }
  }
}
