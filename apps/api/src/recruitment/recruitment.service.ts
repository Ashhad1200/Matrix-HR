import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvitesService } from '../invites/invites.service';
import { ensureBalances } from '../common/leave-balances';
import { assertEmployeeRoom } from '../common/plan-limits';
import { PrismaService } from '../prisma/prisma.service';
import { assertInTenant } from '../common/data-scope';

@Injectable()
export class RecruitmentService {
  constructor(private prisma: PrismaService, private invites: InvitesService) {}

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
    const allowed = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'REJECTED'];
    if (status === 'HIRED') throw new BadRequestException('Use the Hire action to hire a candidate');
    if (!allowed.includes(status)) throw new BadRequestException(`Status must be one of ${allowed.join(', ')}`);
    const app = await this.prisma.jobApplication.findFirst({ where: { id, tenantId } });
    if (!app) throw new NotFoundException('Application not found');
    return this.prisma.jobApplication.update({ where: { id }, data: { status: status as any } });
  }

  /**
   * Turns an applicant into an employee. Safe to repeat (a second click returns the same employee), respects the plan's
   * employee cap, creates this year's leave balances, and can offer the new hire a login in the same step.
   */
  async hireCandidate(tenantId: string, applicationId: string, actor?: { id: string; role: string }, inviteRole?: 'EMPLOYEE' | 'MANAGER' | 'HR_MANAGER' | 'COMPANY_ADMIN') {
    const app = await this.prisma.jobApplication.findFirst({ where: { id: applicationId, tenantId }, include: { job: true } });
    if (!app) throw new NotFoundException('Application not found');

    let employee = app.employeeId ? await this.prisma.employee.findFirst({ where: { id: app.employeeId, tenantId } }) : null;
    if (!employee) {
      await assertEmployeeRoom(this.prisma, tenantId);
      // Next free EMPnnn: counting rows can collide after deletions or imports, so look at what exists.
      const existing = new Set((await this.prisma.employee.findMany({ where: { tenantId, employeeCode: { startsWith: 'EMP' } }, select: { employeeCode: true } })).map((e) => e.employeeCode));
      let n = existing.size + 1;
      while (existing.has(`EMP${String(n).padStart(3, '0')}`)) n++;
      employee = await this.prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: { tenantId, employeeCode: `EMP${String(n).padStart(3, '0')}`, firstName: app.firstName, lastName: app.lastName, email: app.email, phone: app.phone, employmentType: 'PERMANENT', dateOfJoining: new Date(), status: 'ACTIVE' },
        });
        await tx.jobApplication.update({ where: { id: applicationId }, data: { status: 'HIRED', employeeId: created.id } });
        return created;
      });
      await ensureBalances(this.prisma, tenantId, new Date().getFullYear(), [employee.id]).catch(() => undefined);
    }

    if (!inviteRole || !actor) return employee;
    // The hire stands even if the invitation cannot be sent (for example the employee already has a login); say why.
    try {
      return { ...employee, invite: await this.invites.create(tenantId, actor, { employeeId: employee.id, role: inviteRole }) };
    } catch (e: any) {
      return { ...employee, inviteError: e?.message ?? 'Could not send the invitation' };
    }
  }
}
