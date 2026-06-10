import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@matrixhr/database';
import { CreateOneOnOneDto, UpdateOneOnOneDto } from './dto';

const EMPLOYEE_SELECT = {
  select: { id: true, firstName: true, lastName: true, photoUrl: true, designation: { select: { name: true } } },
};

@Injectable()
export class OneOnOnesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, employeeId: string | null, role: UserRole) {
    const isAdmin = role === UserRole.HR_MANAGER || role === UserRole.COMPANY_ADMIN;
    return this.prisma.oneOnOne.findMany({
      where: {
        tenantId,
        ...(isAdmin ? {} : { OR: [{ managerId: employeeId ?? '' }, { employeeId: employeeId ?? '' }] }),
      },
      include: { manager: EMPLOYEE_SELECT, employee: EMPLOYEE_SELECT },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async create(tenantId: string, managerId: string | null, dto: CreateOneOnOneDto) {
    if (!managerId) throw new ForbiddenException('No employee profile linked to this account');
    return this.prisma.oneOnOne.create({
      data: {
        tenantId,
        managerId,
        employeeId: dto.employeeId,
        scheduledAt: new Date(dto.scheduledAt),
        talkingPoints: (dto.talkingPoints ?? []) as any,
      },
      include: { manager: EMPLOYEE_SELECT, employee: EMPLOYEE_SELECT },
    });
  }

  async update(tenantId: string, id: string, requesterId: string | null, role: UserRole, dto: UpdateOneOnOneDto) {
    const meeting = await this.prisma.oneOnOne.findFirst({ where: { id, tenantId } });
    if (!meeting) throw new NotFoundException('1-on-1 not found');

    const isAdmin = role === UserRole.HR_MANAGER || role === UserRole.COMPANY_ADMIN;
    if (!isAdmin && meeting.managerId !== requesterId) {
      throw new ForbiddenException('Only the meeting owner can update it');
    }

    return this.prisma.oneOnOne.update({
      where: { id },
      data: {
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.talkingPoints ? { talkingPoints: dto.talkingPoints as any } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.privateNotes !== undefined ? { privateNotes: dto.privateNotes } : {}),
      },
      include: { manager: EMPLOYEE_SELECT, employee: EMPLOYEE_SELECT },
    });
  }

  async remove(tenantId: string, id: string, requesterId: string | null, role: UserRole) {
    const meeting = await this.prisma.oneOnOne.findFirst({ where: { id, tenantId } });
    if (!meeting) throw new NotFoundException('1-on-1 not found');
    const isAdmin = role === UserRole.HR_MANAGER || role === UserRole.COMPANY_ADMIN;
    if (!isAdmin && meeting.managerId !== requesterId) {
      throw new ForbiddenException('Only the meeting owner can delete it');
    }
    return this.prisma.oneOnOne.delete({ where: { id } });
  }
}
