import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { AssignPlanDto, SetSubscriptionStatusDto, CreateOverrideDto, CreateTenantDto, CreatePlanDto, SetTenantCurrencyDto } from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { LOGO_MAX_BYTES, logoFromBytes } from './logo';

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

  @Post('tenants')
  createTenant(@CurrentUser('id') operatorId: string, @Body() dto: CreateTenantDto) {
    return this.platform.createTenant(operatorId, dto);
  }

  @Get('plans')
  listPlans() {
    return this.platform.listPlans();
  }

  @Post('plans')
  createPlan(@CurrentUser('id') operatorId: string, @Body() dto: CreatePlanDto) {
    return this.platform.createPlan(operatorId, dto);
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

  @Patch('tenants/:id/currency')
  setCurrency(@CurrentUser('id') operatorId: string, @Param('id') tenantId: string, @Body() dto: SetTenantCurrencyDto) {
    return this.platform.setTenantCurrency(operatorId, tenantId, dto);
  }

  @Put('tenants/:id/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES, files: 1 } }))
  setLogo(@CurrentUser('id') operatorId: string, @Param('id') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    return this.platform.setTenantLogo(operatorId, tenantId, logoFromBytes(file?.buffer));
  }

  @Delete('tenants/:id/logo')
  clearLogo(@CurrentUser('id') operatorId: string, @Param('id') tenantId: string) {
    return this.platform.setTenantLogo(operatorId, tenantId, null);
  }

  @Get('audit')
  listAudit(@Query('limit') limit?: string) {
    return this.platform.listAuditLog(limit ? parseInt(limit, 10) : undefined);
  }
}
