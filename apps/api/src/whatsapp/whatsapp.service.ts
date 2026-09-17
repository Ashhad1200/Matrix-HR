import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveService } from '../leave/leave.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UserRole } from '@matrixhr/database';

const APPROVER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN];

@Injectable()
export class WhatsAppService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => LeaveService)) private leave: LeaveService,
    private entitlements: EntitlementsService,
  ) {}

  async sendMessage(tenantId: string, phone: string, body: string, templateName?: string) {
    const token = this.config.get('WHATSAPP_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');

    let status = 'sent';

    if (token && phoneNumberId) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone.replace(/\D/g, ''),
              type: 'text',
              text: { body },
            }),
          },
        );
        status = res.ok ? 'sent' : 'failed';
      } catch {
        status = 'failed';
      }
    }

    const message = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId,
        recipientPhone: phone,
        templateName,
        body,
        status,
        direction: 'outbound',
      },
    });
    await this.entitlements.recordUsage(tenantId, 'whatsapp.messages');
    return message;
  }

  async sendLeaveApprovalRequest(
    tenantId: string,
    managerPhone: string,
    employeeName: string,
    days: number,
    policyName: string,
    requestId: string,
  ) {
    const body = `📋 Leave Request\n\n${employeeName} has requested ${days} day(s) of ${policyName}.\n\nReply:\n✅ APPROVE ${requestId}\n❌ REJECT ${requestId}`;
    return this.sendMessage(tenantId, managerPhone, body, 'leave_approval');
  }

  async handleIncomingMessage(tenantId: string, phone: string, text: string) {
    const upper = text.trim().toUpperCase();

    if (upper.startsWith('BALANCE')) {
      const user = await this.prisma.user.findFirst({
        where: { tenant: { id: tenantId }, employee: { phone: { contains: phone.slice(-10) } } },
        include: { employee: true },
      });
      if (!user?.employeeId) return this.sendMessage(tenantId, phone, 'Employee not found.');

      const balances = await this.prisma.leaveBalance.findMany({
        where: { employeeId: user.employeeId, year: new Date().getFullYear() },
        include: { policy: true },
      });

      const lines = balances.map((b) => {
        const available = Number(b.entitled) - Number(b.used) - Number(b.pending);
        return `${b.policy.name}: ${available} days remaining`;
      });

      return this.sendMessage(tenantId, phone, `📊 Leave Balance\n\n${lines.join('\n')}`);
    }

    if (upper.startsWith('APPROVE ') || upper.startsWith('REJECT ')) {
      const isApprove = upper.startsWith('APPROVE ');
      const requestId = text.trim().split(/\s+/)[1];
      if (!requestId) {
        return this.sendMessage(tenantId, phone, `Usage: ${isApprove ? 'APPROVE' : 'REJECT'} <request-id>`);
      }

      const approver = await this.prisma.user.findFirst({
        where: { tenant: { id: tenantId }, employee: { phone: { contains: phone.slice(-10) } } },
        include: { employee: true },
      });
      if (!approver?.employeeId) {
        return this.sendMessage(tenantId, phone, 'We could not verify your account for this action.');
      }
      if (!APPROVER_ROLES.includes(approver.role)) {
        return this.sendMessage(tenantId, phone, 'Your account is not authorized to approve or reject leave requests.');
      }

      try {
        if (isApprove) {
          await this.leave.approveRequest(tenantId, requestId, approver.employeeId);
          return this.sendMessage(tenantId, phone, `✅ Approved request ${requestId}.`);
        }
        await this.leave.rejectRequest(tenantId, requestId, approver.employeeId, 'Rejected via WhatsApp');
        return this.sendMessage(tenantId, phone, `❌ Rejected request ${requestId}.`);
      } catch (err: any) {
        return this.sendMessage(tenantId, phone, `Could not process request ${requestId}: ${err.message || 'unknown error'}`);
      }
    }

    return this.sendMessage(
      tenantId, phone,
      'MatrixHR Commands:\n• BALANCE - View leave balance\n• APPROVE <id> - Approve a pending leave request (managers/HR/admins)\n• REJECT <id> - Reject a pending leave request (managers/HR/admins)',
    );
  }

  async getMessageLog(tenantId: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
