import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  async getDashboard(
    @TenantId() tenantId: string,
    @CurrentUser() user: { role: UserRole; employeeId?: string },
  ) {
    if (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.HR_MANAGER) {
      return this.dashboard.getHrDashboard(tenantId);
    }
    if (user.role === UserRole.MANAGER && user.employeeId) {
      return this.dashboard.getManagerDashboard(tenantId, user.employeeId);
    }
    if (user.employeeId) {
      return this.dashboard.getEmployeeDashboard(tenantId, user.employeeId);
    }
    return this.dashboard.getHrDashboard(tenantId);
  }
}
