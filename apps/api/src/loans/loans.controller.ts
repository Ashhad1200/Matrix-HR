import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@matrixhr/database';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { CurrentUser, RequireFeature, Roles, TenantId } from '../common/decorators';
import { viewerOf } from '../common/data-scope';
import { CreateLoanDto, LoanDecisionDto } from './dto';

type Me = { id: string; role: string; employeeId?: string };

@Controller('loans')
@UseGuards(JwtAuthGuard, EntitlementGuard)
@RequireFeature('loans.manage')
export class LoansController {
  constructor(private loans: LoansService) {}

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() user: Me, @Query('status') status?: string, @Query('employeeId') employeeId?: string) {
    return this.loans.list(tenantId, viewerOf(user), { status, employeeId });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('inbox')
  inbox(@TenantId() tenantId: string, @CurrentUser() user: Me) {
    return this.loans.inbox(tenantId, viewerOf(user));
  }

  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: Me, @Body() dto: CreateLoanDto) {
    return this.loans.create(tenantId, viewerOf(user), dto);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string) {
    return this.loans.get(tenantId, viewerOf(user), id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post(':id/decision')
  decide(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string, @Body() dto: LoanDecisionDto) {
    return this.loans.decide(tenantId, viewerOf(user), id, dto);
  }

  @Post(':id/cancel')
  cancel(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string) {
    return this.loans.cancel(tenantId, viewerOf(user), id);
  }
}
