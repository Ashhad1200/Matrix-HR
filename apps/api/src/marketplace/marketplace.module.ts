import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [EntitlementsModule, IntegrationsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
