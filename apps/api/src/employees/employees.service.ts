import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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

    return employee;
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

  // Departments
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

  // Designations
  async getDesignations(tenantId: string) {
    return this.prisma.designation.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createDesignation(tenantId: string, data: { name: string; grade?: string; departmentId?: string }) {
    return this.prisma.designation.create({ data: { tenantId, ...data } });
  }

  // Documents
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
