import { Module } from '@nestjs/common';
import { BiometricService } from './biometric.service';
import { BiometricAdminController, ZktecoAdmsController } from './biometric.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [IntegrationsModule, EntitlementsModule],
  controllers: [BiometricAdminController, ZktecoAdmsController],
  providers: [BiometricService],
})
export class BiometricModule {}
