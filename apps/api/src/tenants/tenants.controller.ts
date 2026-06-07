import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('tenants')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get('subdomain/:subdomain')
  findBySubdomain(@Param('subdomain') subdomain: string) {
    return this.tenants.findBySubdomain(subdomain);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @Patch('branding')
  updateBranding(
    @TenantId() tenantId: string,
    @Body() body: { logoUrl?: string; primaryColor?: string },
  ) {
    return this.tenants.updateBranding(tenantId, body);
  }
}
