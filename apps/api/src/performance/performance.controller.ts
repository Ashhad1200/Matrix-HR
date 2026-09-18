import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@matrixhr/database';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { viewerOf } from '../common/data-scope';
import { CreateCycleDto, CreateGoalDto, CreateReviewDto, SubmitReviewDto, UpdateGoalProgressDto } from './dto';

type Me = { id: string; role: string; employeeId?: string };

// Row-level rules (own goals, reports' goals, assigned reviews) live in the service; the guards
// below only gate what is HR-only outright.
@Controller('performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(private performance: PerformanceService) {}

  @Get('cycles')
  getCycles(@TenantId() tenantId: string) {
    return this.performance.getCycles(tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('cycles')
  createCycle(@TenantId() tenantId: string, @Body() body: CreateCycleDto) {
    return this.performance.createCycle(tenantId, body);
  }

  @Get('goals')
  getGoals(@TenantId() tenantId: string, @CurrentUser() user: Me, @Query('employeeId') employeeId?: string) {
    return this.performance.getGoals(tenantId, employeeId, viewerOf(user));
  }

  @Post('goals')
  createGoal(@TenantId() tenantId: string, @CurrentUser() user: Me, @Body() body: CreateGoalDto) {
    return this.performance.createGoal(tenantId, viewerOf(user), body);
  }

  @Patch('goals/:id/progress')
  updateProgress(
    @TenantId() tenantId: string,
    @CurrentUser() user: Me,
    @Param('id') id: string,
    @Body() body: UpdateGoalProgressDto,
  ) {
    return this.performance.updateGoalProgress(tenantId, viewerOf(user), id, body.progress);
  }

  @Get('reviews')
  getReviews(@TenantId() tenantId: string, @CurrentUser() user: Me, @Query('cycleId') cycleId?: string) {
    return this.performance.getReviews(tenantId, cycleId, viewerOf(user));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('reviews')
  createReview(@TenantId() tenantId: string, @Body() body: CreateReviewDto) {
    return this.performance.createReview(tenantId, body);
  }

  @Patch('reviews/:id')
  submitReview(
    @TenantId() tenantId: string,
    @CurrentUser() user: Me,
    @Param('id') id: string,
    @Body() body: SubmitReviewDto,
  ) {
    return this.performance.submitReview(tenantId, viewerOf(user), id, body);
  }
}
