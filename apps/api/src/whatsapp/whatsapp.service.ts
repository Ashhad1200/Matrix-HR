import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveService } from '../leave/leave.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../audit/audit.service';

// No 0/O/1/I so a code read off a phone screen can't be mistyped.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_TTL_MS = 24 * 60 * 60 * 1000;

export type InboundMessage = { id: string; from: string; text: string };

/** Digits only, with Pakistan's local "03xx..." form mapped to its international "923xx..." form. */
export function normalizePhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = `92${digits.slice(1)}`;
  return digits;
}

const mask = (phone: string) => `…${phone.slice(-4)}`;
const codeHash = (tenantId: string, code: string) => createHash('sha256').update(`${tenantId}:${code}`).digest('hex');

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => LeaveService)) private leave: LeaveService,
    private entitlements: EntitlementsService,
    private audit: AuditService,
  ) {}

  // ── Consent ──────────────────────────────────────────────────────────────
  async isOptedIn(tenantId: string, phone: string) {
    const row = await this.prisma.whatsAppConsent.findUnique({
      where: { tenantId_phone: { tenantId, phone: normalizePhone(phone) } },
    });
    return row?.status === 'OPTED_IN';
  }

  async setConsent(tenantId: string, phone: string, status: 'OPTED_IN' | 'OPTED_OUT', source: string) {
    const normalized = normalizePhone(phone);
    return this.prisma.whatsAppConsent.upsert({
      where: { tenantId_phone: { tenantId, phone: normalized } },
      create: { tenantId, phone: normalized, status, source },
      update: { status, source },
    });
  }

  listConsents(tenantId: string) {
    return this.prisma.whatsAppConsent.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, take: 500 });
  }

  async myConsent(tenantId: string, employeeId: string | null | undefined) {
    const emp = employeeId ? await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId }, select: { phone: true } }) : null;
    if (!emp?.phone) return { phone: null, status: 'NO_PHONE' };
    const row = await this.prisma.whatsAppConsent.findUnique({
      where: { tenantId_phone: { tenantId, phone: normalizePhone(emp.phone) } },
    });
    return { phone: normalizePhone(emp.phone), status: row?.status ?? 'NOT_SET' };
  }

  async setMyConsent(tenantId: string, employeeId: string | null | undefined, status: 'OPTED_IN' | 'OPTED_OUT') {
    const emp = employeeId ? await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId }, select: { phone: true } }) : null;
    if (!emp?.phone) return { phone: null, status: 'NO_PHONE' };
    await this.setConsent(tenantId, emp.phone, status, 'SELF_SERVICE');
    return { phone: normalizePhone(emp.phone), status };
  }

  // ── Outbound ─────────────────────────────────────────────────────────────
  /**
   * Business-initiated messages go only to opted-in numbers. `reply: true` is for answering a message
   * the user sent us first (that conversation is user-initiated, so it doesn't need separate opt-in).
   */
  async sendMessage(tenantId: string, phone: string, body: string, opts: { templateName?: string; reply?: boolean } = {}) {
    const token = this.config.get('WHATSAPP_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    let status = 'sent';

    if (!opts.reply && !(await this.isOptedIn(tenantId, phone))) {
      return this.prisma.whatsAppMessage.create({
        data: { tenantId, recipientPhone: phone, templateName: opts.templateName, body: '[not sent: recipient has not opted in]', status: 'blocked_no_consent', direction: 'outbound' },
      });
    }

    if (token && phoneNumberId) {
      try {
        const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizePhone(phone), type: 'text', text: { body } }),
        });
        status = res.ok ? 'sent' : 'failed';
      } catch {
        status = 'failed';
      }
    }

    const message = await this.prisma.whatsAppMessage.create({
      data: { tenantId, recipientPhone: phone, templateName: opts.templateName, body, status, direction: 'outbound' },
    });
    await this.entitlements.recordUsage(tenantId, 'whatsapp.messages');
    return message;
  }

  private async createActionToken(tenantId: string, userId: string, entityType: string, entityId: string) {
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    await this.prisma.whatsAppActionToken.create({
      data: { tenantId, userId, entityType, entityId, codeHash: codeHash(tenantId, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    return code;
  }

  /** The approve/reject code is bound to this approver and this request, single-use, and valid for 24 hours. */
  async sendLeaveApprovalRequest(
    tenantId: string,
    approverUserId: string,
    approverPhone: string,
    employeeName: string,
    days: number,
    policyName: string,
    requestId: string,
  ) {
    const code = await this.createActionToken(tenantId, approverUserId, 'LeaveRequest', requestId);
    const body = `📋 Leave Request\n\n${employeeName} has requested ${days} day(s) of ${policyName}.\n\nReply:\n✅ APPROVE ${code}\n❌ REJECT ${code}\n\nThe code works once and expires in 24 hours.`;
    return this.sendMessage(tenantId, approverPhone, body, { templateName: 'leave_approval' });
  }

  // ── Inbound ──────────────────────────────────────────────────────────────
  /** Which tenant owns the business number a message was sent to. */
  async resolveTenant(phoneNumberId: string | undefined): Promise<string | null> {
    if (!phoneNumberId) return null;
    const rows = await this.prisma.tenantIntegration.findMany({
      where: { provider: 'whatsapp', status: 'connected' },
      select: { tenantId: true, config: true },
    });
    const match = rows.find((r) => (r.config as any)?.phoneNumberId === phoneNumberId);
    if (match) return match.tenantId;
    // Single-tenant deployments can pin the tenant in the environment instead.
    if (this.config.get('WHATSAPP_PHONE_NUMBER_ID') === phoneNumberId && this.config.get('DEFAULT_TENANT_ID')) {
      return this.config.get('DEFAULT_TENANT_ID') as string;
    }
    return null;
  }

  /** Exact match on normalised digits; ambiguous or missing numbers are refused rather than guessed. */
  // ponytail: scans the tenant's employees; store a normalised phone column if headcount makes this hot.
  private async findSender(tenantId: string, from: string) {
    const digits = normalizePhone(from);
    const candidates = await this.prisma.employee.findMany({
      where: { tenantId, phone: { not: null }, status: 'ACTIVE' },
      select: { id: true, phone: true },
    });
    const matches = candidates.filter((c) => normalizePhone(c.phone!) === digits);
    if (matches.length !== 1) return null;
    const user = await this.prisma.user.findFirst({ where: { tenantId, employeeId: matches[0].id, status: 'ACTIVE' } });
    return user ? { user, employeeId: matches[0].id } : null;
  }

  async handleInbound(tenantId: string, msg: InboundMessage) {
    const duplicate = await this.prisma.whatsAppMessage.findUnique({
      where: { tenantId_externalId: { tenantId, externalId: msg.id } },
    });
    if (duplicate) return { duplicate: true };

    const text = msg.text.trim();
    const [command, arg] = text.split(/\s+/);
    const cmd = (command || '').toUpperCase();
    // Codes are credentials — keep them out of the message log.
    const logged = ['APPROVE', 'REJECT'].includes(cmd) ? `${cmd} ****` : text.slice(0, 500);
    await this.prisma.whatsAppMessage.create({
      data: { tenantId, recipientPhone: msg.from, body: logged, status: 'received', direction: 'inbound', externalId: msg.id },
    });

    const reply = (body: string) => this.sendMessage(tenantId, msg.from, body, { reply: true });

    if (['STOP', 'UNSUBSCRIBE', 'CANCEL'].includes(cmd)) {
      await this.setConsent(tenantId, msg.from, 'OPTED_OUT', 'WHATSAPP_REPLY');
      return reply('You have been unsubscribed and will not receive further messages. Reply START to opt back in.');
    }
    if (['START', 'YES', 'SUBSCRIBE'].includes(cmd)) {
      await this.setConsent(tenantId, msg.from, 'OPTED_IN', 'WHATSAPP_REPLY');
      return reply('You are subscribed to MatrixHR notifications. Reply STOP at any time to unsubscribe.');
    }

    const sender = await this.findSender(tenantId, msg.from);
    if (!sender) return reply('We could not verify your account for this action.');

    if (cmd === 'BALANCE') {
      const balances = await this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId: sender.employeeId, year: new Date().getFullYear() },
        include: { policy: true },
      });
      const lines = balances.map((b) => `${b.policy.name}: ${Number(b.entitled) + Number(b.carried) - Number(b.used) - Number(b.pending)} days remaining`);
      return reply(`📊 Leave Balance\n\n${lines.join('\n') || 'No balances found.'}`);
    }

    if (cmd === 'APPROVE' || cmd === 'REJECT') {
      if (!arg) return reply(`Usage: ${cmd} <code from the request message>`);
      const now = new Date();
      // Claiming the code (usedAt) before acting makes it single-use even if two replies race.
      const token = await this.prisma.whatsAppActionToken.findFirst({
        where: { tenantId, userId: sender.user.id, codeHash: codeHash(tenantId, arg.toUpperCase()), usedAt: null, expiresAt: { gt: now } },
      });
      if (!token) return reply('That code is invalid, already used, or has expired.');
      const claimed = await this.prisma.whatsAppActionToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count === 0) return reply('That code is invalid, already used, or has expired.');

      const actor = { userId: sender.user.id, role: sender.user.role, employeeId: sender.employeeId };
      try {
        if (cmd === 'APPROVE') await this.leave.approveRequest(tenantId, token.entityId, actor);
        else await this.leave.rejectRequest(tenantId, token.entityId, actor, 'Rejected via WhatsApp');
        await this.audit.log({
          tenantId, userId: sender.user.id, action: `WHATSAPP_${cmd}`, entity: token.entityType, entityId: token.entityId,
          after: { via: 'whatsapp', phone: mask(normalizePhone(msg.from)), messageId: msg.id },
        });
        return reply(cmd === 'APPROVE' ? '✅ Approved.' : '❌ Rejected.');
      } catch (err: any) {
        this.logger.warn(`WhatsApp ${cmd} failed for token ${token.id}: ${err?.message}`);
        return reply(`Could not process that request: ${err?.message || 'unknown error'}`);
      }
    }

    return reply('MatrixHR Commands:\n• BALANCE - View your leave balance\n• APPROVE <code> / REJECT <code> - Answer a leave request sent to you\n• STOP - Unsubscribe from messages');
  }

  async getMessageLog(tenantId: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
