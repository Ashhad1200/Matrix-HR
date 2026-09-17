import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { LeaveModule } from '../leave/leave.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [forwardRef(() => LeaveModule), EntitlementsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
