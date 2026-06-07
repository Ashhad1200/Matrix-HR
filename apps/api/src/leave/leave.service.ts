import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreateLeaveRequestDto } from './dto';

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private whatsapp: WhatsAppService,
  ) {}

  async getPolicies(tenantId: string) {
    return this.prisma.leavePolicy.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBalances(tenantId: string, employeeId: string) {
    const year = new Date().getFullYear();
    return this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year },
      include: { policy: true },
    });
  }

  async getRequests(tenantId: string, filters?: { employeeId?: string; status?: string }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        ...(filters?.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        policy: true,
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(tenantId: string, employeeId: string, dto: CreateLeaveRequestDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('End date must be after start date');

    const days = dto.isHalfDay ? 0.5 : Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId, policyId: dto.policyId, year: start.getFullYear() },
    });

    if (balance) {
      const available = Number(balance.entitled) + Number(balance.carried) - Number(balance.used) - Number(balance.pending);
      if (days > available) throw new BadRequestException(`Insufficient leave balance. Available: ${available} days`);
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { manager: true },
    });

    const request = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId,
        policyId: dto.policyId,
        startDate: start,
        endDate: end,
        isHalfDay: dto.isHalfDay || false,
        halfDayPeriod: dto.halfDayPeriod,
        days,
        reason: dto.reason,
        approverId: employee?.managerId,
        status: 'PENDING',
      },
      include: { policy: true, employee: true },
    });

    if (balance) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { increment: days } },
      });
    }

    if (employee?.manager) {
      const managerUser = await this.prisma.user.findFirst({
        where: { employeeId: employee.managerId! },
      });
      if (managerUser) {
        await this.notifications.create(
          tenantId, managerUser.id,
          'Leave Request',
          `${employee.firstName} ${employee.lastName} requested ${days} day(s) ${request.policy.name}`,
        );
        if (employee.manager.phone) {
          await this.whatsapp.sendLeaveApprovalRequest(
            tenantId, employee.manager.phone,
            `${employee.firstName} ${employee.lastName}`, days, request.policy.name, request.id,
          );
        }
      }
    }

    return request;
  }

  async approveRequest(tenantId: string, requestId: string, approverId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { employee: true, policy: true },
    });
    if (!request) throw new NotFoundException('Leave request not found');

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', approverId, approvedAt: new Date() },
    });

    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId: request.policyId,
        year: request.startDate.getFullYear(),
      },
    });

    if (balance) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pending: { decrement: Number(request.days) },
          used: { increment: Number(request.days) },
        },
      });
    }

    const empUser = await this.prisma.user.findFirst({ where: { employeeId: request.employeeId } });
    if (empUser) {
      await this.notifications.create(
        tenantId, empUser.id, 'Leave Approved',
        `Your ${request.policy.name} request has been approved.`,
      );
    }

    return updated;
  }

  async rejectRequest(tenantId: string, requestId: string, approverId: string, reason?: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('Leave request not found');

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', approverId, rejectionReason: reason },
    });

    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId: request.policyId,
        year: request.startDate.getFullYear(),
      },
    });

    if (balance) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { decrement: Number(request.days) } },
      });
    }

    return updated;
  }

  async getWhosOut(tenantId: string, month?: string) {
    const start = month ? new Date(`${month}-01`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, department: true } },
        policy: true,
      },
    });
  }

  async getHolidays(tenantId: string, year?: number) {
    const y = year || new Date().getFullYear();
    return this.prisma.holiday.findMany({
      where: {
        tenantId,
        date: {
          gte: new Date(`${y}-01-01`),
          lte: new Date(`${y}-12-31`),
        },
      },
      orderBy: { date: 'asc' },
    });
  }
}
