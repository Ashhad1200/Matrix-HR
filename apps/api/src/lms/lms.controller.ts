import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { LmsService } from './lms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators';

@Controller('lms')
@UseGuards(JwtAuthGuard)
export class LmsController {
  constructor(private lms: LmsService) {}

  @Get('courses')
  getCourses(@TenantId() tenantId: string) {
    return this.lms.getCourses(tenantId);
  }

  @Post('courses')
  createCourse(@TenantId() tenantId: string, @Body() body: any) {
    return this.lms.createCourse(tenantId, body);
  }

  @Post('enroll')
  enroll(@TenantId() tenantId: string, @Body() body: { courseId: string; employeeId: string }) {
    return this.lms.enroll(tenantId, body.courseId, body.employeeId);
  }

  @Patch('enrollments/:id/progress')
  updateProgress(@Param('id') id: string, @Body() body: { progress: number; score?: number }) {
    return this.lms.updateProgress(id, body.progress, body.score);
  }
}
