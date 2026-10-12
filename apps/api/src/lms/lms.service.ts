import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Viewer, isHrPlus, assertInTenant } from '../common/data-scope';

@Injectable()
export class LmsService {
  constructor(private prisma: PrismaService) {}

  async getCourses(tenantId: string) {
    return this.prisma.course.findMany({
      where: { tenantId, status: 'PUBLISHED' },
      include: { _count: { select: { enrollments: true } } },
    });
  }

  async myEnrollments(tenantId: string, employeeId: string | null) {
    if (!employeeId) return [];
    return this.prisma.courseEnrollment.findMany({
      where: { employeeId, course: { tenantId } },
      include: { course: { select: { id: true, title: true, isMandatory: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCourse(tenantId: string, id: string, data: { title?: string; description?: string; isMandatory?: boolean; status?: 'PUBLISHED' | 'ARCHIVED' }) {
    const c = await this.prisma.course.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Course not found');
    return this.prisma.course.update({ where: { id }, data: { ...(data.title !== undefined ? { title: data.title } : {}), ...(data.description !== undefined ? { description: data.description } : {}), ...(data.isMandatory !== undefined ? { isMandatory: data.isMandatory } : {}), ...(data.status ? { status: data.status } : {}) } });
  }

  async createCourse(tenantId: string, data: { title: string; description?: string; isMandatory?: boolean }) {
    return this.prisma.course.create({
      data: { tenantId, title: data.title, description: data.description, isMandatory: data.isMandatory ?? false, status: 'PUBLISHED' },
    });
  }

  /** Everyone may enrol themself; only HR may enrol someone else. Both ends must belong to this tenant. */
  async enroll(tenantId: string, viewer: Viewer, courseId: string, requestedEmployeeId?: string) {
    const employeeId = isHrPlus(viewer.role) && requestedEmployeeId ? requestedEmployeeId : viewer.employeeId;
    if (!employeeId) throw new BadRequestException('No employee profile is linked to this account');
    await assertInTenant(this.prisma, tenantId, [
      { model: 'employee', id: employeeId },
      { model: 'course', id: courseId },
    ]);
    return this.prisma.courseEnrollment.upsert({
      where: { courseId_employeeId: { courseId, employeeId } },
      update: {},
      create: { courseId, employeeId },
    });
  }

  async updateProgress(tenantId: string, viewer: Viewer, enrollmentId: string, progress: number, score?: number) {
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: { id: enrollmentId, course: { tenantId } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (!isHrPlus(viewer.role) && enrollment.employeeId !== viewer.employeeId) {
      throw new ForbiddenException('You can only update your own course progress');
    }
    return this.prisma.courseEnrollment.update({
      where: { id: enrollmentId },
      data: { progress, score, completedAt: progress >= 100 ? new Date() : undefined },
    });
  }
}
