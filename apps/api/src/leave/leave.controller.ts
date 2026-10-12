import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateLeaveRequestDto, CreateLeavePolicyDto, UpdateLeavePolicyDto, CreateHolidayDto, UpdateHolidayDto } from './dto';
import { viewerOf } from '../common/data-scope';

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private leave: LeaveService) {}

  @Get('policies')
  getPolicies(@TenantId() tenantId: string) {
    return this.leave.getPolicies(tenantId);
  }

  @Get('balances')
  getBalances(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string) {
    return this.leave.getBalances(tenantId, employeeId);
  }

  @Get('requests')
  getRequests(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.leave.getRequests(tenantId, { employeeId, status }, viewerOf(user));
  }

  @Get('whos-out')
  getWhosOut(@TenantId() tenantId: string, @Query('month') month?: string) {
    return this.leave.getWhosOut(tenantId, month);
  }

  @Get('holidays')
  getHolidays(@TenantId() tenantId: string, @Query('year') year?: string) {
    return this.leave.getHolidays(tenantId, year ? parseInt(year) : undefined);
  }

  @Post('requests')
  createRequest(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leave.createRequest(tenantId, employeeId, dto, userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('requests/:id/approve')
  approve(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
  ) {
    return this.leave.approveRequest(tenantId, id, { userId: user.id, role: user.role, employeeId: user.employeeId });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('requests/:id/reject')
  reject(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
    @Body('reason') reason?: string,
  ) {
    return this.leave.rejectRequest(tenantId, id, { userId: user.id, role: user.role, employeeId: user.employeeId }, reason);
  }

  // ── Leave setup: HR and company admins only ──────────────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('policies/all')
  allPolicies(@TenantId() tenantId: string) { return this.leave.listAllPolicies(tenantId); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('policies')
  createPolicy(@TenantId() t: string, @CurrentUser('id') u: string, @Body() dto: CreateLeavePolicyDto) { return this.leave.createPolicy(t, u, dto); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('policies/:id')
  updatePolicy(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string, @Body() dto: UpdateLeavePolicyDto) { return this.leave.updatePolicy(t, u, id, dto); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('balances/rebuild')
  rebuild(@TenantId() t: string, @CurrentUser('id') u: string, @Query('year') year?: string) { return this.leave.rebuildBalances(t, u, year ? parseInt(year, 10) : undefined); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('holidays')
  createHoliday(@TenantId() t: string, @CurrentUser('id') u: string, @Body() dto: CreateHolidayDto) { return this.leave.createHoliday(t, u, dto); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('holidays/:id')
  updateHoliday(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string, @Body() dto: UpdateHolidayDto) { return this.leave.updateHoliday(t, u, id, dto); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Delete('holidays/:id')
  deleteHoliday(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string) { return this.leave.deleteHoliday(t, u, id); }
}
