import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.webhooks.findAll(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooks.findOne(tenantId, id);
  }

  @Get(':id/deliveries')
  deliveries(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooks.listDeliveries(tenantId, id, status, limit ? parseInt(limit, 10) : undefined);
  }

  @Post(':id/test')
  test(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooks.sendTest(tenantId, id);
  }

  @Post('deliveries/:deliveryId/redeliver')
  redeliver(@TenantId() tenantId: string, @Param('deliveryId') deliveryId: string) {
    return this.webhooks.redeliver(tenantId, deliveryId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(tenantId, dto);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooks.remove(tenantId, id);
  }
}
