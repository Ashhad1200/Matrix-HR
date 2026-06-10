import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateProjectDto, CreateTimeEntryDto, UpdateTimeEntryDto, SubmitWeekDto } from './dto';

@Controller('timesheets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimesheetsController {
  constructor(private timesheets: TimesheetsService) {}

  @Get('projects')
  getProjects(@TenantId() tenantId: string) {
    return this.timesheets.getProjects(tenantId);
  }

  @Post('projects')
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  createProject(@TenantId() tenantId: string, @Body() dto: CreateProjectDto) {
    return this.timesheets.createProject(tenantId, dto);
  }

  @Get('entries')
  getMyWeek(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.timesheets.getMyWeek(tenantId, employeeId, weekStart);
  }

  @Post('entries')
  createEntry(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timesheets.createEntry(tenantId, employeeId, dto);
  }

  @Patch('entries/:id')
  updateEntry(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.timesheets.updateEntry(tenantId, employeeId, id, dto);
  }

  @Delete('entries/:id')
  deleteEntry(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Param('id') id: string,
  ) {
    return this.timesheets.deleteEntry(tenantId, employeeId, id);
  }

  @Post('submit')
  submitWeek(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: SubmitWeekDto,
  ) {
    return this.timesheets.submitWeek(tenantId, employeeId, dto.weekStart);
  }

  @Get('pending')
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  getPending(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.timesheets.getPending(tenantId, employeeId, role);
  }

  @Patch('entries/:id/approve')
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  approve(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.timesheets.setEntryStatus(tenantId, id, 'approved');
  }

  @Patch('entries/:id/reject')
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  reject(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.timesheets.setEntryStatus(tenantId, id, 'rejected');
  }
}
