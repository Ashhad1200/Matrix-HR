import { Controller, Get, Put, Body, Param, Header, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { SsoService } from './sso.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

class UpsertSsoConfigDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  entryPoint?: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  certificate?: string;

  @IsOptional()
  @IsString()
  metadataUrl?: string;

  @IsOptional()
  @IsArray()
  domains?: string[];
}

@Controller('sso')
export class SsoController {
  constructor(private sso: SsoService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Get('config')
  getConfig(@TenantId() tenantId: string) {
    return this.sso.getConfig(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Put('config')
  upsertConfig(@TenantId() tenantId: string, @Body() dto: UpsertSsoConfigDto) {
    return this.sso.upsertConfig(tenantId, dto);
  }

  @Get(':subdomain/metadata')
  @Header('Content-Type', 'application/xml')
  getMetadata(@Param('subdomain') subdomain: string) {
    return this.sso.getSpMetadata(subdomain);
  }

  @Get(':subdomain/login-hint')
  getLoginHint(@Param('subdomain') subdomain: string) {
    return this.sso.getLoginHint(subdomain);
  }
}
