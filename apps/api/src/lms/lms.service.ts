import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LmsService {
  constructor(private prisma: PrismaService) {}

  async getCourses(tenantId: string) {
    return this.prisma.course.findMany({
      where: { tenantId, status: 'PUBLISHED' },
      include: { _count: { select: { enrollments: true } } },
    });
  }

  async createCourse(tenantId: string, data: {
    title: string; description?: string; isMandatory?: boolean;
  }) {
    return this.prisma.course.create({
      data: { tenantId, ...data, status: 'PUBLISHED' },
    });
  }

  async enroll(tenantId: string, courseId: string, employeeId: string) {
    return this.prisma.courseEnrollment.upsert({
      where: { courseId_employeeId: { courseId, employeeId } },
      update: {},
      create: { courseId, employeeId },
    });
  }

  async updateProgress(enrollmentId: string, progress: number, score?: number) {
    return this.prisma.courseEnrollment.update({
      where: { id: enrollmentId },
      data: {
        progress,
        score,
        completedAt: progress >= 100 ? new Date() : undefined,
      },
    });
  }
}
