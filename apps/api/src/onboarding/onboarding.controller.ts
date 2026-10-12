import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { viewerOf } from '../common/data-scope';
import { CurrentUser } from '../common/decorators';
import { StartOnboardingDto, CreateTemplateDto, UpdateTemplateDto } from './dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @Get('templates')
  getTemplates(@TenantId() tenantId: string) {
    return this.onboarding.getTemplates(tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('templates')
  createTemplate(@TenantId() tenantId: string, @Body() body: CreateTemplateDto) {
    return this.onboarding.createTemplate(tenantId, body);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch('templates/:id')
  updateTemplate(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: UpdateTemplateDto) {
    return this.onboarding.updateTemplate(tenantId, id, body);
  }

  @Get('progress')
  getProgress(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
    @Query('employeeId') employeeId?: string,
  ) {
    return this.onboarding.getProgress(tenantId, employeeId, viewerOf(user));
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
    @Body() body: StartOnboardingDto,
  ) {
    return this.onboarding.startOnboarding(tenantId, body.employeeId, body.templateId);
  }

  @Patch('tasks/:progressId/:taskId/complete')
  completeTask(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
    @Param('progressId') progressId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.onboarding.completeTask(tenantId, viewerOf(user), progressId, taskId);
  }
}
