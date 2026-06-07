import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators';

@Controller('performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(private performance: PerformanceService) {}

  @Get('cycles')
  getCycles(@TenantId() tenantId: string) {
    return this.performance.getCycles(tenantId);
  }

  @Post('cycles')
  createCycle(@TenantId() tenantId: string, @Body() body: any) {
    return this.performance.createCycle(tenantId, body);
  }

  @Get('goals')
  getGoals(@TenantId() tenantId: string, @Query('employeeId') employeeId?: string) {
    return this.performance.getGoals(tenantId, employeeId);
  }

  @Post('goals')
  createGoal(@TenantId() tenantId: string, @Body() body: any) {
    return this.performance.createGoal(tenantId, body);
  }

  @Patch('goals/:id/progress')
  updateProgress(@Param('id') id: string, @Body('progress') progress: number) {
    return this.performance.updateGoalProgress(id, progress);
  }
}
