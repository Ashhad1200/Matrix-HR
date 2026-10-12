import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { singleCompanyMode } from '../deployment';

/** Billing and payments do not exist on a single-company installation: their routes answer 404, as if never built. */
@Injectable()
export class BillingEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (singleCompanyMode()) throw new NotFoundException();
    return true;
  }
}
