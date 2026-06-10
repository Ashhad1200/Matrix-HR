import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private marketplace: MarketplaceService) {}

  @Get('integrations')
  getIntegrations(@TenantId() tenantId: string, @Query('category') category?: string) {
    return this.marketplace.getIntegrations(tenantId, category);
  }

  @Get('categories')
  getCategories() {
    return this.marketplace.getCategories();
  }

  @Post(':id/connect')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  connect(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.marketplace.connect(tenantId, id);
  }

  @Post(':id/disconnect')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  disconnect(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.marketplace.disconnect(tenantId, id);
  }

  @Post(':id/sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  sync(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.marketplace.sync(tenantId, id);
  }
}
