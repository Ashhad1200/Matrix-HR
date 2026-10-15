import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringWorker } from './monitoring.worker';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { viewerOf } from '../common/data-scope';
import { UpdateMonitoringSettingsDto, PairDeviceDto } from './dto';

type ReqUser = { id: string; role: string; employeeId?: string | null };

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private monitoring: MonitoringService, private worker: MonitoringWorker) {}

  // ── HR / admin: settings ────────────────────────────────────────────────
  @UseGuards(RolesGuard) @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('settings')
  getSettings(@TenantId() tenantId: string) {
    return this.monitoring.getSettings(tenantId);
  }

  @UseGuards(RolesGuard) @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Put('settings')
  updateSettings(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Body() dto: UpdateMonitoringSettingsDto) {
    return this.monitoring.updateSettings(tenantId, userId, dto);
  }

  // ── HR / manager: read views (scoped to self+reports for managers) ────────
  @UseGuards(RolesGuard) @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('overview')
  overview(@TenantId() tenantId: string, @CurrentUser() u: ReqUser) {
    return this.monitoring.overview(tenantId, viewerOf(u));
  }

  @UseGuards(RolesGuard) @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('summaries')
  summaries(@TenantId() tenantId: string, @CurrentUser() u: ReqUser,
    @Query('employeeId') employeeId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.monitoring.summaries(tenantId, viewerOf(u), employeeId, from, to);
  }

  @UseGuards(RolesGuard) @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('devices')
  devices(@TenantId() tenantId: string, @CurrentUser() u: ReqUser) {
    return this.monitoring.devices(tenantId, viewerOf(u));
  }

  @UseGuards(RolesGuard) @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('devices/:id/revoke')
  revoke(@TenantId() tenantId: string, @CurrentUser() u: ReqUser, @Param('id') id: string) {
    return this.monitoring.revokeDevice(tenantId, viewerOf(u), u.id, id);
  }

  @UseGuards(RolesGuard) @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('alerts')
  alerts(@TenantId() tenantId: string, @CurrentUser() u: ReqUser, @Query('resolved') resolved?: string) {
    return this.monitoring.alerts(tenantId, viewerOf(u), resolved === undefined ? undefined : resolved === 'true');
  }

  @UseGuards(RolesGuard) @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('alerts/:id/resolve')
  resolveAlert(@TenantId() tenantId: string, @CurrentUser() u: ReqUser, @Param('id') id: string) {
    return this.monitoring.resolveAlert(tenantId, viewerOf(u), u.id, id);
  }

  /** Admin-only: run the rollup/offline/purge jobs now (the timer runs them every 5 min in production). */
  @UseGuards(RolesGuard) @Roles(UserRole.COMPANY_ADMIN)
  @Post('run-maintenance')
  async runMaintenance() {
    const rebuilt = await this.worker.rollupRecent();
    const raised = await this.worker.detectOffline();
    const purged = await this.worker.purge();
    return { rebuilt, raised, purged };
  }

  // ── Employee self-service (any signed-in user) ────────────────────────────
  @Get('me')
  me(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string | null) {
    return this.monitoring.mySummary(tenantId, employeeId);
  }

  @Post('me/consent')
  consent(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string | null, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').toString().slice(0, 64) || undefined;
    return this.monitoring.consent(tenantId, employeeId, ip);
  }

  @Post('me/devices')
  pair(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string | null, @Body() dto: PairDeviceDto) {
    return this.monitoring.pairDevice(tenantId, employeeId, dto);
  }

  @Delete('me/devices/:id')
  removeOwn(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string | null, @Param('id') id: string) {
    return this.monitoring.removeOwnDevice(tenantId, employeeId, id);
  }

  @Get('me/activity')
  myActivity(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string | null,
    @Query('from') from?: string, @Query('to') to?: string) {
    return this.monitoring.myActivity(tenantId, employeeId, from, to);
  }
}
