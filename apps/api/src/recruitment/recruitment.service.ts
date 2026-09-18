import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertInTenant } from '../common/data-scope';

@Injectable()
export class RecruitmentService {
  constructor(private prisma: PrismaService) {}

  async getJobs(tenantId: string) {
    return this.prisma.jobPosting.findMany({
      where: { tenantId },
      include: { _count: { select: { applications: true } } },
      orderBy: { postedAt: 'desc' },
    });
  }

  async createJob(tenantId: string, data: {
    title: string; department?: string; description?: string; requirements?: string;
  }) {
    return this.prisma.jobPosting.create({
      data: { tenantId, title: data.title, department: data.department, description: data.description, requirements: data.requirements },
    });
  }

  async getApplications(tenantId: string, jobId?: string) {
    return this.prisma.jobApplication.findMany({
      where: { tenantId, ...(jobId ? { jobId } : {}) },
      include: { job: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApplication(tenantId: string, data: {
    jobId: string; firstName: string; lastName: string; email: string;
    phone?: string; resumeUrl?: string; source?: string;
  }) {
    await assertInTenant(this.prisma, tenantId, [{ model: 'jobPosting', id: data.jobId, label: 'job' }]);
    return this.prisma.jobApplication.create({
      data: {
        tenantId, jobId: data.jobId, firstName: data.firstName, lastName: data.lastName, email: data.email,
        phone: data.phone, resumeUrl: data.resumeUrl, source: data.source,
      },
    });
  }

  async updateApplicationStatus(tenantId: string, id: string, status: string) {
    const app = await this.prisma.jobApplication.findFirst({ where: { id, tenantId } });
    if (!app) throw new NotFoundException('Application not found');
    return this.prisma.jobApplication.update({ where: { id }, data: { status: status as any } });
  }

  async hireCandidate(tenantId: string, applicationId: string) {
    const app = await this.prisma.jobApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: { job: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const count = await this.prisma.employee.count({ where: { tenantId } });
    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        employeeCode: `EMP${String(count + 1).padStart(3, '0')}`,
        firstName: app.firstName,
        lastName: app.lastName,
        email: app.email,
        phone: app.phone,
        employmentType: 'PERMANENT',
        dateOfJoining: new Date(),
        status: 'ACTIVE',
      },
    });

    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'HIRED', employeeId: employee.id },
    });

    return employee;
  }
}
