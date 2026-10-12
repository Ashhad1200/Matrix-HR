import { Body, Controller, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@matrixhr/database';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { BillingAdminService } from './billing-admin.service';
import { AccountDto, ApproveDto, GrantCreditsDto, PackEditDto, PeriodDto, PlanEditDto, RejectDto, SettingsDto } from './dto';
import { sendProof } from './billing.controller';

/** Operator billing backoffice. Cross-tenant by nature, so it is SUPER_ADMIN only and deliberately not tenant-scoped. */
@Controller('platform/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BillingAdminController {
  constructor(private admin: BillingAdminService) {}

  @Get('queue') queue() { return this.admin.queue(); }
  @Get('history') history(@Query('status') status?: string, @Query('tenantId') tenantId?: string) { return this.admin.history(status, tenantId); }
  @Get('requests/:id/proof') async proof(@Param('id') id: string, @Res() res: Response) { sendProof(res, await this.admin.proof(id)); }
  @Get('requests/:id/receipt') receipt(@Param('id') id: string) { return this.admin.receipt(id); }
  @Post('requests/:id/approve') approve(@CurrentUser('id') op: string, @Param('id') id: string, @Body() dto: ApproveDto) { return this.admin.approve(op, id, dto); }
  @Post('requests/:id/reject') reject(@CurrentUser('id') op: string, @Param('id') id: string, @Body() dto: RejectDto) { return this.admin.reject(op, id, dto); }

  @Get('accounts') accounts() { return this.admin.accounts(); }
  @Post('accounts') createAccount(@CurrentUser('id') op: string, @Body() dto: AccountDto) { return this.admin.createAccount(op, dto); }
  @Patch('accounts/:id') updateAccount(@CurrentUser('id') op: string, @Param('id') id: string, @Body() dto: Partial<AccountDto>) { return this.admin.updateAccount(op, id, dto); }

  @Get('settings') settings() { return this.admin.settings(); }
  @Put('settings') updateSettings(@CurrentUser('id') op: string, @Body() dto: SettingsDto) { return this.admin.updateSettings(op, dto); }

  @Get('plans') plans() { return this.admin.plans(); }
  @Patch('plans/:code') editPlan(@CurrentUser('id') op: string, @Param('code') code: string, @Body() dto: PlanEditDto) { return this.admin.editPlan(op, code, dto); }
  @Get('packs') packs() { return this.admin.packs(); }
  @Patch('packs/:code') editPack(@CurrentUser('id') op: string, @Param('code') code: string, @Body() dto: PackEditDto) { return this.admin.editPack(op, code, dto); }

  @Get('clock-report') clockReport() { return this.admin.clockReport(); }
  @Get('tenants/:id') tenant(@Param('id') id: string) { return this.admin.tenantBilling(id); }
  @Put('tenants/:id/period') setPeriod(@CurrentUser('id') op: string, @Param('id') id: string, @Body() dto: PeriodDto) { return this.admin.setPeriod(op, id, dto); }
  @Post('tenants/:id/credits') grant(@CurrentUser('id') op: string, @Param('id') id: string, @Body() dto: GrantCreditsDto) { return this.admin.grantCredits(op, id, dto); }
  @Get('ai-usage') usage(@Query('tenantId') tenantId?: string) { return this.admin.usage(tenantId); }
}
