import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateLeaveRequestDto } from './dto';

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
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.leave.getRequests(tenantId, { employeeId, status });
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
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leave.createRequest(tenantId, employeeId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('requests/:id/approve')
  approve(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('employeeId') approverId: string,
  ) {
    return this.leave.approveRequest(tenantId, id, approverId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('requests/:id/reject')
  reject(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('employeeId') approverId: string,
    @Body('reason') reason?: string,
  ) {
    return this.leave.rejectRequest(tenantId, id, approverId, reason);
  }
}
