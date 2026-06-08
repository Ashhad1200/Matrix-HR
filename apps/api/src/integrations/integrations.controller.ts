import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class IntegrationsController {
  constructor(private integrations: IntegrationsService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.integrations.findAll(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateIntegrationDto) {
    return this.integrations.create(tenantId, dto);
  }

  @Post(':provider/install')
  install(@TenantId() tenantId: string, @Param('provider') provider: string) {
    return this.integrations.install(tenantId, provider);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrations.findOne(tenantId, id);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateIntegrationDto) {
    return this.integrations.update(tenantId, id, dto);
  }
}
