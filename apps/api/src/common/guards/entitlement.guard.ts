import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from '../decorators';
import { EntitlementsService } from '../../entitlements/entitlements.service';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!featureKey) return true;

    const { user } = context.switchToHttp().getRequest();
    // SUPER_ADMIN operates the platform, not a purchased seat — never entitlement-gated.
    if (user?.role === 'SUPER_ADMIN') return true;

    const allowed = await this.entitlements.hasFeature(user.tenantId, featureKey);
    if (!allowed) {
      throw new ForbiddenException(`This feature (${featureKey}) is not included in your current plan`);
    }
    return true;
  }
}
