import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { EntitlementGuard } from '../common/guards/entitlement.guard';

@Module({
  providers: [EntitlementsService, EntitlementGuard],
  exports: [EntitlementsService, EntitlementGuard],
})
export class EntitlementsModule {}
