import { Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { seedBulkData } from '@matrixhr/database';

@Controller('dev')
export class DevController {
  constructor(private prisma: PrismaService) {}

  @Post('seed-bulk')
  async seedBulk() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not available in production' };
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain: 'acme' } });
    if (!tenant) return { error: 'Run base seed first (pnpm db:seed)' };

    const passwordHash = await bcrypt.hash('Password123!', 12);
    const departments = await this.prisma.department.findMany({ where: { tenantId: tenant.id } });
    const designations = await this.prisma.designation.findMany({ where: { tenantId: tenant.id } });
    const engDept = departments.find((d) => d.name === 'Engineering')!;
    const seDesig = designations.find((d) => d.name === 'Software Engineer')!;
    const manager = await this.prisma.employee.findFirst({
      where: { tenantId: tenant.id, employeeCode: 'EMP001' },
    });
    const shift = await this.prisma.shift.findFirst({ where: { tenantId: tenant.id } });
    const template = await this.prisma.onboardingTemplate.findFirst({ where: { tenantId: tenant.id } });
    const templateTasks = template
      ? await this.prisma.onboardingTask.findMany({ where: { templateId: template.id } })
      : [];
    const adminUser = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'admin@acme.com' },
    });
    const hrUser = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'hr@acme.com' },
    });
    const annual = await this.prisma.leavePolicy.findFirst({ where: { tenantId: tenant.id, code: 'annual' } });
    const casual = await this.prisma.leavePolicy.findFirst({ where: { tenantId: tenant.id, code: 'casual' } });
    const sick = await this.prisma.leavePolicy.findFirst({ where: { tenantId: tenant.id, code: 'sick' } });

    if (!manager || !shift || !template || !adminUser || !hrUser || !annual || !casual || !sick) {
      return { error: 'Missing base seed data' };
    }

    const result = await seedBulkData(this.prisma, tenant.id, {
      departments,
      designations,
      engDeptId: engDept.id,
      seDesignationId: seDesig.id,
      managerId: manager.id,
      shiftId: shift.id,
      templateId: template.id,
      templateTaskIds: templateTasks.map((t) => t.id),
      adminUserId: adminUser.id,
      hrUserId: hrUser.id,
      policyIds: { annual: annual.id, casual: casual.id, sick: sick.id },
      passwordHash,
    });

    return { ok: true, ...result };
  }
}
