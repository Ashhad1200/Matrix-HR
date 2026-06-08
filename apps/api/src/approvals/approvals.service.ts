import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@matrixhr/database';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async getInbox(tenantId: string, employeeId: string | undefined, role: UserRole) {
    const isHr = role === UserRole.HR_MANAGER || role === UserRole.COMPANY_ADMIN;

    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        ...(isHr ? {} : { approverId: employeeId }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true } },
        policy: true,
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
