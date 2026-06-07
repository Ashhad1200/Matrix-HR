import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { ClockInDto } from './dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Post('clock-in')
  clockIn(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: ClockInDto,
  ) {
    return this.attendance.clockIn(tenantId, employeeId, dto);
  }

  @Post('clock-out')
  clockOut(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.attendance.clockOut(tenantId, employeeId);
  }

  @Get('my-logs')
  getMyLogs(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Query('month') month?: string,
  ) {
    return this.attendance.getMyLogs(tenantId, employeeId, month);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @Get('dashboard')
  getDashboard(@TenantId() tenantId: string) {
    return this.attendance.getTodayDashboard(tenantId);
  }

  @Post('regularization')
  requestRegularization(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() body: { date: string; reason: string; requestedClockIn?: string; requestedClockOut?: string },
  ) {
    return this.attendance.requestRegularization(tenantId, employeeId, body);
  }
}
