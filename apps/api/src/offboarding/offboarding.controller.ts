import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@matrixhr/database';
import { OffboardingService } from './offboarding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { ClearItemDto, ExitInterviewDto, InitiateOffboardingDto, OffboardingDecisionDto } from './dto';

type Me = { id: string; role: string; employeeId?: string | null };
const actorOf = (u: Me) => ({ userId: u.id, role: u.role, employeeId: u.employeeId });

// Object-level checks (own case, direct manager, role rank for each step)
// live in the service; the role guards below are the coarse outer gate.
@Controller('offboarding')
@UseGuards(JwtAuthGuard)
export class OffboardingController {
  constructor(private offboarding: OffboardingService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get()
  list(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.offboarding.list(tenantId, status);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('inbox')
  inbox(@TenantId() tenantId: string, @CurrentUser() user: Me) {
    return this.offboarding.inbox(tenantId, actorOf(user));
  }

  @Get('mine')
  mine(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string) {
    return this.offboarding.listMine(tenantId, employeeId);
  }

  @Post()
  initiate(@TenantId() tenantId: string, @CurrentUser() user: Me, @Body() dto: InitiateOffboardingDto) {
    return this.offboarding.initiate(tenantId, actorOf(user), dto);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: Me) {
    return this.offboarding.get(tenantId, id, actorOf(user));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post(':id/decision')
  decide(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Me,
    @Body() dto: OffboardingDecisionDto,
  ) {
    return this.offboarding.decide(tenantId, id, actorOf(user), dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post(':id/clearance/:itemId/clear')
  clear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: Me,
    @Body() dto: ClearItemDto,
  ) {
    return this.offboarding.clearItem(tenantId, id, itemId, actorOf(user), dto);
  }

  @Post(':id/exit-interview')
  exitInterview(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: Me,
    @Body() dto: ExitInterviewDto,
  ) {
    return this.offboarding.submitExitInterview(tenantId, id, actorOf(user), dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post(':id/settlement/recalculate')
  recalc(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: Me) {
    return this.offboarding.recalculateSettlement(tenantId, id, actorOf(user));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Post(':id/complete')
  complete(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: Me) {
    return this.offboarding.complete(tenantId, id, actorOf(user));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post(':id/cancel')
  cancel(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: Me) {
    return this.offboarding.cancel(tenantId, id, actorOf(user));
  }
}
