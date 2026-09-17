import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { AssignPlanDto, SetSubscriptionStatusDto, CreateOverrideDto } from './dto';

// Platform operations are cross-tenant by nature (a SUPER_ADMIN manages every
// tenant's commercial state), so this controller deliberately does NOT use
// @TenantId() scoping anywhere — access control is entirely role-based.
@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformController {
  constructor(private platform: PlatformService) {}

  @Get('tenants')
  listTenants() {
    return this.platform.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.platform.getTenant(id);
  }

  @Get('plans')
  listPlans() {
    return this.platform.listPlans();
  }

  @Post('tenants/:id/subscription')
  assignPlan(@CurrentUser('id') operatorId: string, @Param('id') tenantId: string, @Body() dto: AssignPlanDto) {
    return this.platform.assignPlan(operatorId, tenantId, dto.planCode);
  }

  @Patch('tenants/:id/subscription/status')
  setStatus(@CurrentUser('id') operatorId: string, @Param('id') tenantId: string, @Body() dto: SetSubscriptionStatusDto) {
    return this.platform.setSubscriptionStatus(operatorId, tenantId, dto.status);
  }

  @Post('tenants/:id/overrides')
  createOverride(@CurrentUser('id') operatorId: string, @Param('id') tenantId: string, @Body() dto: CreateOverrideDto) {
    return this.platform.createOverride(operatorId, tenantId, dto);
  }

  @Delete('tenants/:id/overrides/:overrideId')
  deleteOverride(
    @CurrentUser('id') operatorId: string,
    @Param('id') tenantId: string,
    @Param('overrideId') overrideId: string,
  ) {
    return this.platform.deleteOverride(operatorId, tenantId, overrideId);
  }

  @Get('audit')
  listAudit(@Query('limit') limit?: string) {
    return this.platform.listAuditLog(limit ? parseInt(limit, 10) : undefined);
  }
}
