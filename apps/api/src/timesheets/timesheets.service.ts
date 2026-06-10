import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@matrixhr/database';
import { CreateProjectDto, CreateTimeEntryDto, UpdateTimeEntryDto } from './dto';

@Injectable()
export class TimesheetsService {
  constructor(private prisma: PrismaService) {}

  // ── Projects ──────────────────────────────────────────────────────────────
  async getProjects(tenantId: string) {
    return this.prisma.project.findMany({
      where: { tenantId },
      include: { _count: { select: { entries: true } } },
      orderBy: { key: 'asc' },
    });
  }

  async createProject(tenantId: string, dto: CreateProjectDto) {
    return this.prisma.project.upsert({
      where: { tenantId_key: { tenantId, key: dto.key.toUpperCase() } },
      create: { tenantId, key: dto.key.toUpperCase(), name: dto.name },
      update: { name: dto.name, status: 'active' },
    });
  }

  // ── Entries ───────────────────────────────────────────────────────────────
  async getMyWeek(tenantId: string, employeeId: string | null, weekStart?: string) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked');
    const start = weekStart ? new Date(weekStart) : this.startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const entries = await this.prisma.timeEntry.findMany({
      where: { tenantId, employeeId, date: { gte: start, lt: end } },
      include: { project: { select: { id: true, key: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
    return { weekStart: start.toISOString().slice(0, 10), entries, totalHours };
  }

  async createEntry(tenantId: string, employeeId: string | null, dto: CreateTimeEntryDto) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked');
    return this.prisma.timeEntry.create({
      data: {
        tenantId,
        employeeId,
        projectId: dto.projectId,
        date: new Date(dto.date),
        hours: dto.hours,
        note: dto.note,
      },
      include: { project: { select: { id: true, key: true, name: true } } },
    });
  }

  async updateEntry(tenantId: string, employeeId: string | null, id: string, dto: UpdateTimeEntryDto) {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.employeeId !== employeeId) throw new ForbiddenException('Not your entry');
    if (entry.status === 'approved') throw new BadRequestException('Approved entries are locked');

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.hours != null ? { hours: dto.hours } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId || null } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        status: 'draft',
      },
    });
  }

  async deleteEntry(tenantId: string, employeeId: string | null, id: string) {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.employeeId !== employeeId) throw new ForbiddenException('Not your entry');
    if (entry.status === 'approved') throw new BadRequestException('Approved entries are locked');
    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async submitWeek(tenantId: string, employeeId: string | null, weekStart: string) {
    if (!employeeId) throw new ForbiddenException('No employee profile linked');
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const result = await this.prisma.timeEntry.updateMany({
      where: { tenantId, employeeId, date: { gte: start, lt: end }, status: 'draft' },
      data: { status: 'submitted' },
    });
    return { submitted: result.count };
  }

  // ── Manager approval ──────────────────────────────────────────────────────
  async getPending(tenantId: string, approverId: string | null, role: UserRole) {
    const isAdmin = role === UserRole.HR_MANAGER || role === UserRole.COMPANY_ADMIN;
    return this.prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: 'submitted',
        ...(isAdmin ? {} : { employee: { managerId: approverId ?? '' } }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, key: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  async setEntryStatus(tenantId: string, id: string, status: 'approved' | 'rejected') {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Time entry not found');
    return this.prisma.timeEntry.update({ where: { id }, data: { status } });
  }

  private startOfWeek(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7; // Monday = 1
    date.setUTCDate(date.getUTCDate() - day + 1);
    return date;
  }
}
