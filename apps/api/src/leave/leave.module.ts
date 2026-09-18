import { Module, forwardRef } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [NotificationsModule, WorkflowsModule, forwardRef(() => WhatsAppModule)],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
