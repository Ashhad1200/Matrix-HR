import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId, RequireFeature } from '../common/decorators';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { UserRole } from '@matrixhr/database';
import { CreateCompensationItemDto, ReopenPayrollRunDto } from './dto';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class PayrollController {
  constructor(private payroll: PayrollService) {}

  @Get('runs')
  getRuns(@TenantId() tenantId: string) {
    return this.payroll.getPayrollRuns(tenantId);
  }

  @Post('runs')
  createRun(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Query('period') period: string) {
    return this.payroll.createPayrollRun(tenantId, period || new Date().toISOString().slice(0, 7), userId);
  }

  @Get('runs/:id')
  getRun(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.getPayrollRun(tenantId, id);
  }

  @Post('runs/:id/recalculate')
  recalculate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.recalculateDraftRun(tenantId, id);
  }

  @Post('runs/:id/submit')
  submit(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.submitForReview(tenantId, id);
  }

  @Post('runs/:id/approve')
  approve(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.payroll.approvePayrollRun(tenantId, id, userId);
  }

  @Post('runs/:id/lock')
  lock(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.lockPayrollRun(tenantId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Post('runs/:id/reopen')
  reopen(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ReopenPayrollRunDto,
  ) {
    return this.payroll.reopenPayrollRun(tenantId, id, userId, dto.reason);
  }

  @Get('runs/:id/items/:itemId/payslip')
  getPayslip(@TenantId() tenantId: string, @Param('itemId') itemId: string) {
    return this.payroll.getPayslipUrl(tenantId, itemId);
  }

  @UseGuards(EntitlementGuard)
  @RequireFeature('accounting.export')
  @Get('runs/:id/journal')
  journal(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.exportJournal(tenantId, id);
  }

  @Get('runs/:id/bank-file')
  async bankFile(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('bank') bank: string,
  ) {
    const run = await this.payroll.getPayrollRun(tenantId, id);
    return this.payroll.generateBankFile(run, bank || 'meezan');
  }

  @Get('w2')
  getW2Forms(@TenantId() tenantId: string, @Query('year') year?: string) {
    return this.payroll.generateW2Forms(tenantId, year ? Number(year) : new Date().getFullYear() - 1);
  }

  @Get('compensation-items')
  listCompensationItems(@TenantId() tenantId: string, @Query('employeeId') employeeId?: string) {
    return this.payroll.listCompensationItems(tenantId, employeeId);
  }

  @Post('compensation-items')
  createCompensationItem(@TenantId() tenantId: string, @Body() dto: CreateCompensationItemDto) {
    return this.payroll.createCompensationItem(tenantId, dto);
  }

  @Delete('compensation-items/:id')
  deleteCompensationItem(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.deleteCompensationItem(tenantId, id);
  }
}
