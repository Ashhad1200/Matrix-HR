import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AssistantController, AiAdminController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AiSettingsService } from './ai-settings.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CreditsModule } from '../credits/credits.service';
import { CredentialCipherModule } from '../crypto/credential-cipher.module';
import { LeaveModule } from '../leave/leave.module';

@Module({
  imports: [EntitlementsModule, CreditsModule, CredentialCipherModule, LeaveModule],
  controllers: [AiController, AssistantController, AiAdminController],
  providers: [AiService, AssistantService, AiSettingsService],
  exports: [AiSettingsService],
})
export class AiModule {}
