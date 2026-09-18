import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { LmsService } from './lms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { viewerOf } from '../common/data-scope';
import { CurrentUser } from '../common/decorators';
import { CreateCourseDto, EnrollDto, UpdateProgressDto } from './dto';

@Controller('lms')
@UseGuards(JwtAuthGuard)
export class LmsController {
  constructor(private lms: LmsService) {}

  @Get('courses')
  getCourses(@TenantId() tenantId: string) {
    return this.lms.getCourses(tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  @Post('courses')
  createCourse(@TenantId() tenantId: string, @Body() body: CreateCourseDto) {
    return this.lms.createCourse(tenantId, body);
  }

  @Post('enroll')
  enroll(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
    @Body() body: EnrollDto,
  ) {
    return this.lms.enroll(tenantId, viewerOf(user), body.courseId, body.employeeId);
  }

  @Patch('enrollments/:id/progress')
  updateProgress(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
    @Param('id') id: string,
    @Body() body: UpdateProgressDto,
  ) {
    return this.lms.updateProgress(tenantId, viewerOf(user), id, body.progress, body.score);
  }
}
