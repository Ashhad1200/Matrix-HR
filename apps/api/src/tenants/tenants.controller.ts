import { IsHexColor, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

export class UpdateBrandingDto {
  @IsOptional() @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }) @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
}

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
    @Body() body: UpdateBrandingDto,
  ) {
    return this.tenants.updateBranding(tenantId, body);
  }
}
