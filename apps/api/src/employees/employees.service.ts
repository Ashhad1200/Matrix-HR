import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Viewer, isHrPlus, assertInTenant } from '../common/data-scope';
import { AuditService } from '../audit/audit.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { FilesService } from '../uploads/files.service';
import { ensureBalances } from '../common/leave-balances';
import { assertEmployeeRoom } from '../common/plan-limits';
import { CreateEmployeeDto, UpdateEmployeeDto, SelfUpdateEmployeeDto } from './dto';

// What a colleague may see of another colleague: enough for a people directory, no pay, ID or bank data.
const DIRECTORY_SELECT = {
  id: true, employeeCode: true, firstName: true, lastName: true, email: true, photoUrl: true, status: true,
  designation: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private webhooks: WebhooksService,
    private onboarding: OnboardingService,
    private entitlements: EntitlementsService,
    private files: FilesService,
  ) {}

  async findAll(tenantId: string, filters?: {
    departmentId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }, viewer?: Viewer) {
    const full = !viewer || isHrPlus(viewer.role);
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || 20));
    const where: any = { tenantId };

    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
        // Searching by CNIC would let anyone confirm a colleague's CNIC, so only HR may.
        ...(full ? [{ cnic: { contains: filters.search } }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        ...((full
          ? { include: { department: true, designation: true, manager: { select: { id: true, firstName: true, lastName: true } } } }
          : { select: DIRECTORY_SELECT }) as {}),
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { firstName: 'asc' },
      }) as Promise<any[]>,
      this.prisma.employee.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Viewer-aware read: HR and the employee themself get the full record, everyone else the directory view. */
  async findOneFor(tenantId: string, id: string, viewer: Viewer) {
    if (isHrPlus(viewer.role) || viewer.employeeId === id) return this.findOne(tenantId, id);
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId }, select: DIRECTORY_SELECT });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        designation: true,
        manager: true,
        directReports: { select: { id: true, firstName: true, lastName: true, designation: true } },
        documents: true,
        family: true,
        skills: true,
        history: { orderBy: { effectiveFrom: 'desc' } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async assertBiometricPinFree(tenantId: string, pin?: string, exceptEmployeeId?: string) {
    if (!pin) return;
    const clash = await this.prisma.employee.findFirst({
      where: { tenantId, biometricPin: pin, ...(exceptEmployeeId ? { NOT: { id: exceptEmployeeId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException('Biometric PIN is already assigned to another employee');
  }

  private assertWithinPlanLimit(tenantId: string) {
    return assertEmployeeRoom(this.prisma, tenantId);
  }

  async create(tenantId: string, userId: string, dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: { tenantId_employeeCode: { tenantId, employeeCode: dto.employeeCode } },
    });
    if (existing) throw new ConflictException('Employee code already exists');
    await this.assertBiometricPinFree(tenantId, dto.biometricPin);
    await this.assertWithinPlanLimit(tenantId);
    await assertInTenant(this.prisma, tenantId, [
      { model: 'employee', id: dto.managerId, label: 'manager' },
      { model: 'department', id: dto.departmentId },
      { model: 'designation', id: dto.designationId },
    ]);

    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        cnic: dto.cnic,
        biometricPin: dto.biometricPin,
        designationId: dto.designationId,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
        employmentType: dto.employmentType || 'PERMANENT',
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        baseSalary: dto.baseSalary,
        status: 'ACTIVE',
      },
      include: { department: true, designation: true },
    });

    await this.audit.log({
      tenantId, userId, action: 'CREATE', entity: 'Employee', entityId: employee.id, after: employee,
    });
    await this.entitlements.recordUsage(tenantId, 'employee.created');
    // Leave balances for this year, for every active leave type. Never fails the hire: they are also created on first use.
    await ensureBalances(this.prisma, tenantId, new Date().getFullYear(), [employee.id]).catch(() => undefined);

    return employee;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateEmployeeDto) {
    const before = await this.findOne(tenantId, id);
    await this.assertBiometricPinFree(tenantId, dto.biometricPin, id);
    await assertInTenant(this.prisma, tenantId, [
      { model: 'employee', id: dto.managerId, label: 'manager' },
      { model: 'department', id: dto.departmentId },
      { model: 'designation', id: dto.designationId },
    ]);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        baseSalary: dto.baseSalary,
      },
      include: { department: true, designation: true },
    });

    await this.audit.log({
      tenantId, userId, action: 'UPDATE', entity: 'Employee', entityId: id, before, after: employee,
    });

    if (dto.status === 'TERMINATED' && before.status !== 'TERMINATED') {
      await this.handleTerminationCascade(tenantId, employee);
    }

    return employee;
  }

  private async handleTerminationCascade(
    tenantId: string,
    employee: { id: string; employeeCode: string; firstName: string; lastName: string; email: string | null },
  ) {
    const linkedUser = await this.prisma.user.findFirst({
      where: { tenantId, employeeId: employee.id },
    });

    if (linkedUser) {
      await this.prisma.user.update({
        where: { id: linkedUser.id },
        data: { status: 'INACTIVE' },
      });
    }

    const offboardingTemplate = await this.prisma.onboardingTemplate.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: 'offboarding', mode: 'insensitive' } },
          { role: 'offboarding' },
        ],
      },
    });

    if (offboardingTemplate) {
      await this.onboarding.startOnboarding(tenantId, employee.id, offboardingTemplate.id);
    }

    await this.webhooks.dispatch(tenantId, 'employee.terminated', {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      terminatedAt: new Date().toISOString(),
    });
  }

  async selfUpdate(tenantId: string, employeeId: string, dto: SelfUpdateEmployeeDto) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked to this account');
    await this.findOne(tenantId, employeeId);

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        phone: dto.phone,
        currentAddress: dto.currentAddress,
        permanentAddress: dto.permanentAddress,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
      },
      include: { department: true, designation: true },
    });
  }

  async getTeam(tenantId: string, managerEmployeeId: string) {
    if (!managerEmployeeId) throw new ForbiddenException('No employee profile linked to this account');

    return this.prisma.employee.findMany({
      where: { tenantId, managerId: managerEmployeeId, status: 'ACTIVE' },
      select: {
        ...DIRECTORY_SELECT,
        phone: true,
        dateOfJoining: true,
        employmentType: true,
        workLocation: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }

  async getMyPayslips(tenantId: string, employeeId: string) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked to this account');

    const items = await this.prisma.payrollItem.findMany({
      where: {
        employeeId,
        payrollRun: { tenantId, status: { in: ['APPROVED', 'PROCESSED', 'LOCKED'] } },
      },
      include: {
        payrollRun: { select: { id: true, period: true, status: true, processedAt: true } },
      },
      orderBy: { payrollRun: { period: 'desc' } },
    });
    // The stored file reference is internal; the client asks for a short-lived signed link per payslip instead.
    return items.map(({ payslipUrl, ...rest }) => ({ ...rest, hasPayslip: !!payslipUrl }));
  }

  /** A signed link to the caller's OWN payslip only (never someone else's, whatever id is passed). */
  async getMyPayslipLink(tenantId: string, employeeId: string, itemId: string) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked to this account');
    const item = await this.prisma.payrollItem.findFirst({
      where: { id: itemId, employeeId, payrollRun: { tenantId, status: { in: ['APPROVED', 'PROCESSED', 'LOCKED'] } } },
      include: { payrollRun: { select: { period: true } } },
    });
    if (!item?.payslipUrl) throw new NotFoundException('Payslip not found');
    return this.files.linkFor(tenantId, item.payslipUrl, { name: `payslip-${item.payrollRun.period}.pdf` });
  }

  /** Signed link to one employee document: HR+ for anyone, an employee only for their own. */
  async getDocumentLink(tenantId: string, employeeId: string, docId: string, viewer: Viewer) {
    if (!isHrPlus(viewer.role) && viewer.employeeId !== employeeId) throw new ForbiddenException('You can only open your own documents');
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id: docId, employeeId, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.files.linkFor(tenantId, doc.fileUrl, { name: doc.name });
  }

  async getOrgChart(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true, firstName: true, lastName: true, photoUrl: true,
        managerId: true, designation: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    const buildTree = (managerId: string | null): any[] =>
      employees
        .filter((e) => e.managerId === managerId)
        .map((e) => ({ ...e, children: buildTree(e.id) }));

    return buildTree(null);
  }

  async importCsv(tenantId: string, userId: string, rows: CreateEmployeeDto[]) {
    const results = { created: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        await this.create(tenantId, userId, row);
        results.created++;
      } catch (e: any) {
        results.errors.push(`${row.employeeCode}: ${e.message}`);
      }
    }

    return results;
  }

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  private async assertNameFree(model: 'department' | 'designation', tenantId: string, name: string, exceptId?: string) {
    const clash = await (this.prisma as any)[model].findFirst({ where: { tenantId, name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (clash) throw new ConflictException(`A ${model} named "${name.trim()}" already exists`);
  }

  async createDepartment(tenantId: string, data: { name: string; parentId?: string }, userId?: string) {
    await assertInTenant(this.prisma, tenantId, [{ model: 'department', id: data.parentId, label: 'parent department' }]);
    await this.assertNameFree('department', tenantId, data.name);
    const d = await this.prisma.department.create({ data: { tenantId, name: data.name.trim(), parentId: data.parentId } });
    await this.audit.log({ tenantId, userId, action: 'CREATE', entity: 'Department', entityId: d.id, after: { name: d.name, parentId: d.parentId } });
    return d;
  }

  /** Rename or move a department. A department cannot become its own descendant. */
  async updateDepartment(tenantId: string, id: string, data: { name?: string; parentId?: string | null }, userId?: string) {
    const d = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Department not found');
    if (data.parentId) {
      await assertInTenant(this.prisma, tenantId, [{ model: 'department', id: data.parentId, label: 'parent department' }]);
      for (let cur: string | null = data.parentId, hops = 0; cur && hops < 50; hops++) {
        if (cur === id) throw new BadRequestException('A department cannot sit under itself or one of its own sub-departments');
        cur = (await this.prisma.department.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
      }
    }
    if (data.name !== undefined) await this.assertNameFree('department', tenantId, data.name, id);
    const u = await this.prisma.department.update({ where: { id }, data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.parentId !== undefined ? { parentId: data.parentId } : {}) } });
    await this.audit.log({ tenantId, userId, action: 'UPDATE', entity: 'Department', entityId: id, before: { name: d.name, parentId: d.parentId }, after: { name: u.name, parentId: u.parentId } });
    return u;
  }

  /** Refused while anything still points at it: people, sub-departments or job titles. */
  async deleteDepartment(tenantId: string, id: string, userId?: string) {
    const d = await this.prisma.department.findFirst({ where: { id, tenantId }, include: { _count: { select: { employees: true, children: true, designations: true } } } });
    if (!d) throw new NotFoundException('Department not found');
    const { employees, children, designations } = d._count;
    if (employees || children || designations) {
      const parts = [employees && `${employees} employee${employees === 1 ? '' : 's'}`, children && `${children} sub-department${children === 1 ? '' : 's'}`, designations && `${designations} job title${designations === 1 ? '' : 's'}`].filter(Boolean);
      throw new ConflictException(`"${d.name}" is still in use by ${parts.join(', ')}. Move or remove them first.`);
    }
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({ tenantId, userId, action: 'DELETE', entity: 'Department', entityId: id, before: { name: d.name } });
    return { deleted: true };
  }

  /** Bulk create from a pasted list; existing names are skipped, never duplicated. Parents may appear earlier in the same list. */
  async importDepartments(tenantId: string, rows: { name: string; parent?: string }[], userId?: string) {
    const existing = new Map((await this.prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } })).map((d) => [d.name.toLowerCase(), d.id]));
    const created: string[] = []; const skipped: string[] = []; const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      const name = r.name.trim(); const key = name.toLowerCase();
      if (existing.has(key)) { skipped.push(name); continue; }
      let parentId: string | undefined;
      if (r.parent?.trim()) {
        parentId = existing.get(r.parent.trim().toLowerCase());
        if (!parentId) { errors.push(`Row ${i + 1} (${name}): parent "${r.parent.trim()}" does not exist`); continue; }
      }
      const d = await this.prisma.department.create({ data: { tenantId, name, parentId } });
      existing.set(key, d.id); created.push(name);
    }
    await this.audit.log({ tenantId, userId, action: 'IMPORT', entity: 'Department', after: { created: created.length, skipped: skipped.length, errors: errors.length } });
    return { created: created.length, skipped: skipped.length, errors };
  }

  async getDesignations(tenantId: string) {
    return this.prisma.designation.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDesignation(tenantId: string, data: { name: string; grade?: string; departmentId?: string }, userId?: string) {
    await assertInTenant(this.prisma, tenantId, [{ model: 'department', id: data.departmentId }]);
    await this.assertNameFree('designation', tenantId, data.name);
    const d = await this.prisma.designation.create({ data: { tenantId, name: data.name.trim(), grade: data.grade, departmentId: data.departmentId } });
    await this.audit.log({ tenantId, userId, action: 'CREATE', entity: 'Designation', entityId: d.id, after: { name: d.name, grade: d.grade, departmentId: d.departmentId } });
    return d;
  }

  async updateDesignation(tenantId: string, id: string, data: { name?: string; grade?: string | null; departmentId?: string | null }, userId?: string) {
    const d = await this.prisma.designation.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Job title not found');
    await assertInTenant(this.prisma, tenantId, [{ model: 'department', id: data.departmentId ?? undefined }]);
    if (data.name !== undefined) await this.assertNameFree('designation', tenantId, data.name, id);
    const u = await this.prisma.designation.update({ where: { id }, data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.grade !== undefined ? { grade: data.grade } : {}), ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}) } });
    await this.audit.log({ tenantId, userId, action: 'UPDATE', entity: 'Designation', entityId: id, before: { name: d.name, grade: d.grade, departmentId: d.departmentId }, after: { name: u.name, grade: u.grade, departmentId: u.departmentId } });
    return u;
  }

  async deleteDesignation(tenantId: string, id: string, userId?: string) {
    const d = await this.prisma.designation.findFirst({ where: { id, tenantId }, include: { _count: { select: { employees: true } } } });
    if (!d) throw new NotFoundException('Job title not found');
    if (d._count.employees) throw new ConflictException(`"${d.name}" is still held by ${d._count.employees} employee${d._count.employees === 1 ? '' : 's'}. Change their job title first.`);
    await this.prisma.designation.delete({ where: { id } });
    await this.audit.log({ tenantId, userId, action: 'DELETE', entity: 'Designation', entityId: id, before: { name: d.name } });
    return { deleted: true };
  }

  async importDesignations(tenantId: string, rows: { name: string; grade?: string; department?: string }[], userId?: string) {
    const have = new Set((await this.prisma.designation.findMany({ where: { tenantId }, select: { name: true } })).map((d) => d.name.toLowerCase()));
    const depts = new Map((await this.prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } })).map((d) => [d.name.toLowerCase(), d.id]));
    const created: string[] = []; const skipped: string[] = []; const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      const name = r.name.trim();
      if (have.has(name.toLowerCase())) { skipped.push(name); continue; }
      let departmentId: string | undefined;
      if (r.department?.trim()) {
        departmentId = depts.get(r.department.trim().toLowerCase());
        if (!departmentId) { errors.push(`Row ${i + 1} (${name}): department "${r.department.trim()}" does not exist`); continue; }
      }
      await this.prisma.designation.create({ data: { tenantId, name, grade: r.grade?.trim() || undefined, departmentId } });
      have.add(name.toLowerCase()); created.push(name);
    }
    await this.audit.log({ tenantId, userId, action: 'IMPORT', entity: 'Designation', after: { created: created.length, skipped: skipped.length, errors: errors.length } });
    return { created: created.length, skipped: skipped.length, errors };
  }

  async addDocument(tenantId: string, employeeId: string, data: {
    type: string; name: string; fileKey?: string; fileUrl?: string; expiryDate?: string;
  }, viewer: Viewer) {
    if (!isHrPlus(viewer.role) && viewer.employeeId !== employeeId) {
      throw new ForbiddenException('You can only add documents to your own profile');
    }
    await this.findOne(tenantId, employeeId);
    // The file must be one this tenant uploaded: an arbitrary URL (or another tenant's object key) is refused.
    const ref = data.fileKey ? `s3:${data.fileKey}` : data.fileUrl;
    if (!ref) throw new BadRequestException('Attach a file');
    this.files.linkFor(tenantId, ref); // throws NotFound unless it resolves to this tenant's own object
    return this.prisma.employeeDocument.create({
      data: {
        tenantId, employeeId,
        type: data.type, name: data.name, fileUrl: ref,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });
  }
}
