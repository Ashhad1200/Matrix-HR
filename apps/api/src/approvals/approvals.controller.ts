import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}

  @Get('inbox')
  getInbox(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.approvals.getInbox(tenantId, employeeId, role);
  }
}
