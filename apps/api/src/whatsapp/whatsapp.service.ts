import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
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

    return this.prisma.whatsAppMessage.create({
      data: {
        tenantId,
        recipientPhone: phone,
        templateName,
        body,
        status,
        direction: 'outbound',
      },
    });
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

    if (upper.startsWith('APPROVE ')) {
      const requestId = text.split(' ')[1];
      return this.sendMessage(tenantId, phone, `Approved request ${requestId}. Please use the web app to confirm.`);
    }

    return this.sendMessage(
      tenantId, phone,
      'MatrixHR Commands:\n• balance - View leave balance\n• attendance - This month attendance\n• team - Who\'s out today',
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
