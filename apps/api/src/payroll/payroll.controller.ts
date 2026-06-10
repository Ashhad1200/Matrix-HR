import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

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
  createRun(@TenantId() tenantId: string, @Query('period') period: string) {
    return this.payroll.createPayrollRun(tenantId, period || new Date().toISOString().slice(0, 7));
  }

  @Get('runs/:id')
  getRun(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.getPayrollRun(tenantId, id);
  }

  @Post('runs/:id/approve')
  approve(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.approvePayrollRun(tenantId, id);
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
}
