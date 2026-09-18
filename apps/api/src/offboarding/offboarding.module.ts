import { Module } from '@nestjs/common';
import { OffboardingService } from './offboarding.service';
import { OffboardingController } from './offboarding.controller';
import { WorkflowsModule } from '../workflows/workflows.module';
import { PayrollModule } from '../payroll/payroll.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [WorkflowsModule, PayrollModule, NotificationsModule, WebhooksModule],
  controllers: [OffboardingController],
  providers: [OffboardingService],
})
export class OffboardingModule {}
