import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { CreateEmployeeDto, UpdateEmployeeDto, SelfUpdateEmployeeDto } from './dto';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private webhooks: WebhooksService,
    private onboarding: OnboardingService,
  ) {}

  async findAll(tenantId: string, filters?: {
    departmentId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const where: any = { tenantId };

    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
        { cnic: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: { department: true, designation: true, manager: { select: { id: true, firstName: true, lastName: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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

  async create(tenantId: string, userId: string, dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: { tenantId_employeeCode: { tenantId, employeeCode: dto.employeeCode } },
    });
    if (existing) throw new ConflictException('Employee code already exists');

    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        cnic: dto.cnic,
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

    return employee;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateEmployeeDto) {
    const before = await this.findOne(tenantId, id);
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
      include: {
        designation: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  async getMyPayslips(tenantId: string, employeeId: string) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked to this account');

    return this.prisma.payrollItem.findMany({
      where: {
        employeeId,
        payrollRun: { tenantId, status: { in: ['APPROVED', 'PROCESSED', 'LOCKED'] } },
      },
      include: {
        payrollRun: { select: { id: true, period: true, status: true, processedAt: true } },
      },
      orderBy: { payrollRun: { period: 'desc' } },
    });
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

  async createDepartment(tenantId: string, data: { name: string; parentId?: string }) {
    return this.prisma.department.create({ data: { tenantId, ...data } });
  }

  async getDesignations(tenantId: string) {
    return this.prisma.designation.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createDesignation(tenantId: string, data: { name: string; grade?: string; departmentId?: string }) {
    return this.prisma.designation.create({ data: { tenantId, ...data } });
  }

  async addDocument(tenantId: string, employeeId: string, data: {
    type: string; name: string; fileUrl: string; expiryDate?: string;
  }) {
    await this.findOne(tenantId, employeeId);
    return this.prisma.employeeDocument.create({
      data: {
        tenantId, employeeId,
        type: data.type, name: data.name, fileUrl: data.fileUrl,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });
  }
}
