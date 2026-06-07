import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @Get('templates')
  getTemplates(@TenantId() tenantId: string) {
    return this.onboarding.getTemplates(tenantId);
  }

  @Get('progress')
  getProgress(@TenantId() tenantId: string, @Query('employeeId') employeeId?: string) {
    return this.onboarding.getProgress(tenantId, employeeId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('dashboard')
  getDashboard(@TenantId() tenantId: string) {
    return this.onboarding.getDashboard(tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('start')
  startOnboarding(
    @TenantId() tenantId: string,
    @Body() body: { employeeId: string; templateId: string },
  ) {
    return this.onboarding.startOnboarding(tenantId, body.employeeId, body.templateId);
  }

  @Patch('tasks/:progressId/:taskId/complete')
  completeTask(@Param('progressId') progressId: string, @Param('taskId') taskId: string) {
    return this.onboarding.completeTask(progressId, taskId);
  }
}
