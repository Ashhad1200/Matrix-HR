import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private marketplace: MarketplaceService) {}

  @Get('integrations')
  getIntegrations(@Query('category') category?: string) {
    return this.marketplace.getIntegrations(category);
  }

  @Get('categories')
  getCategories() {
    return this.marketplace.getCategories();
  }
}
