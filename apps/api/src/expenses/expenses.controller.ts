import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@matrixhr/database';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { CurrentUser, RequireFeature, Roles, TenantId } from '../common/decorators';
import { viewerOf } from '../common/data-scope';
import { ClaimDecisionDto, CreateCategoryDto, CreateClaimDto, UpdateCategoryDto, UpdateClaimDto } from './dto';

type Me = { id: string; role: string; employeeId?: string };

// Object-level rules (own claim, direct manager, HR) live in the service; guards here gate plan + coarse role.
@Controller('expenses')
@UseGuards(JwtAuthGuard, EntitlementGuard)
@RequireFeature('expenses.manage')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get('categories')
  categories(@TenantId() tenantId: string, @Query('all') all?: string) {
    return this.expenses.listCategories(tenantId, all === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('categories')
  createCategory(@TenantId() tenantId: string, @Body() dto: CreateCategoryDto) {
    return this.expenses.createCategory(tenantId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('categories/:id')
  updateCategory(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.expenses.updateCategory(tenantId, id, dto);
  }

  @Get('claims')
  list(@TenantId() tenantId: string, @CurrentUser() user: Me, @Query('status') status?: string, @Query('employeeId') employeeId?: string) {
    return this.expenses.listClaims(tenantId, viewerOf(user), { status, employeeId });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('inbox')
  inbox(@TenantId() tenantId: string, @CurrentUser() user: Me) {
    return this.expenses.inbox(tenantId, viewerOf(user));
  }

  @Post('claims')
  create(@TenantId() tenantId: string, @CurrentUser() user: Me, @Body() dto: CreateClaimDto) {
    return this.expenses.createClaim(tenantId, viewerOf(user), dto);
  }

  @Get('claims/:id')
  get(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string) {
    return this.expenses.getClaim(tenantId, viewerOf(user), id);
  }

  @Patch('claims/:id')
  update(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string, @Body() dto: UpdateClaimDto) {
    return this.expenses.updateClaim(tenantId, viewerOf(user), id, dto);
  }

  @Delete('claims/:id')
  remove(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string) {
    return this.expenses.deleteClaim(tenantId, viewerOf(user), id);
  }

  @Post('claims/:id/submit')
  submit(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string) {
    return this.expenses.submitClaim(tenantId, viewerOf(user), id);
  }

  @Post('claims/:id/cancel')
  cancel(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string) {
    return this.expenses.cancelClaim(tenantId, viewerOf(user), id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('claims/:id/decision')
  decide(@TenantId() tenantId: string, @CurrentUser() user: Me, @Param('id') id: string, @Body() dto: ClaimDecisionDto) {
    return this.expenses.decide(tenantId, viewerOf(user), id, dto);
  }
}
