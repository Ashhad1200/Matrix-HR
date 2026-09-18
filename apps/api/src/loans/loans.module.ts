import { Module } from '@nestjs/common';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { WorkflowsModule } from '../workflows/workflows.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [WorkflowsModule, NotificationsModule, EntitlementsModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
