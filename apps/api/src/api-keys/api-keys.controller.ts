import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class ApiKeysController {
  constructor(private apiKeys: ApiKeysService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.apiKeys.findAll(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(tenantId, dto.name);
  }

  @Delete(':id')
  revoke(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.apiKeys.revoke(tenantId, id);
  }
}
