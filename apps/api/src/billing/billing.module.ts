import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CreditsModule } from '../credits/credits.service';
import { BillingService } from './billing.service';
import { BillingAdminService } from './billing-admin.service';
import { BillingController } from './billing.controller';
import { BillingAdminController } from './billing-admin.controller';
import { BillingWorker } from './billing.worker';

@Module({
  imports: [AuditModule, CreditsModule],
  controllers: [BillingController, BillingAdminController],
  providers: [BillingService, BillingAdminService, BillingWorker],
  exports: [BillingService, BillingAdminService],
})
export class BillingModule {}
