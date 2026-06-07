import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('recruitment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class RecruitmentController {
  constructor(private recruitment: RecruitmentService) {}

  @Get('jobs')
  getJobs(@TenantId() tenantId: string) {
    return this.recruitment.getJobs(tenantId);
  }

  @Post('jobs')
  createJob(@TenantId() tenantId: string, @Body() body: any) {
    return this.recruitment.createJob(tenantId, body);
  }

  @Get('applications')
  getApplications(@TenantId() tenantId: string, @Query('jobId') jobId?: string) {
    return this.recruitment.getApplications(tenantId, jobId);
  }

  @Post('applications')
  createApplication(@TenantId() tenantId: string, @Body() body: any) {
    return this.recruitment.createApplication(tenantId, body);
  }

  @Patch('applications/:id/status')
  updateStatus(@TenantId() tenantId: string, @Param('id') id: string, @Body('status') status: string) {
    return this.recruitment.updateApplicationStatus(tenantId, id, status);
  }

  @Post('applications/:id/hire')
  hire(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.recruitment.hireCandidate(tenantId, id);
  }
}
