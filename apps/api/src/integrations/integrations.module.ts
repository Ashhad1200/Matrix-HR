import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationSyncService } from './integration-sync.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationSyncService],
  exports: [IntegrationsService, IntegrationSyncService],
})
export class IntegrationsModule {}
