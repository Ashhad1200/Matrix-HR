import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@matrixhr/database';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async getInbox(tenantId: string, employeeId: string | undefined, role: UserRole) {
    const isHr = role === UserRole.HR_MANAGER || role === UserRole.COMPANY_ADMIN;
    // Without this guard a null/undefined approverId would either drop the
    // filter (leaking every pending request) or match unassigned requests.
    if (!isHr && !employeeId) {
      throw new ForbiddenException('No employee profile linked to this account');
    }

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
