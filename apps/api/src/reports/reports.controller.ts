import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('headcount')
  headcount(@TenantId() tenantId: string) {
    return this.reports.headcountByDepartment(tenantId);
  }

  @Get('leave-consumption')
  leaveConsumption(@TenantId() tenantId: string, @Query('year') year?: string) {
    return this.reports.leaveConsumption(tenantId, year ? parseInt(year) : undefined);
  }

  @Get('attendance')
  attendance(@TenantId() tenantId: string, @Query('month') month: string) {
    return this.reports.attendanceSummary(tenantId, month || new Date().toISOString().slice(0, 7));
  }

  @Get('payroll-cost')
  payrollCost(@TenantId() tenantId: string) {
    return this.reports.payrollCostAnalysis(tenantId);
  }
}
