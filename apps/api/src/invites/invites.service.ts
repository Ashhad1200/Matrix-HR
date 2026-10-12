import { brandName } from '../common/brand';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailOutboxService, MailService } from '../mail/mail.service';
import { assertAdminSeatRoom, ADMIN_ROLES } from '../common/plan-limits';

const TTL_MS = 7 * 86_400_000;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
type Actor = { id: string; role: string };
type InviteRole = 'EMPLOYEE' | 'MANAGER' | 'HR_MANAGER' | 'COMPANY_ADMIN';

/**
 * Staff logins. HR/admin invite an existing employee: no password is ever chosen for them. The invitee gets an emailed,
 * single-use, expiring link, sets their own password, and only then does a User row exist (linked to the employee).
 */
@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private outbox: EmailOutboxService, private mail: MailService) {}

  private status(i: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }) {
    if (i.usedAt) return 'accepted';
    if (i.revokedAt) return 'revoked';
    return i.expiresAt.getTime() < Date.now() ? 'expired' : 'pending';
  }

  private link(token: string) {
    return `${(process.env.WEB_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '')}/accept-invite?token=${token}`;
  }

  /** Everyone employed, with whether they can sign in yet. */
  async people(tenantId: string) {
    const [employees, users, invites] = await Promise.all([
      this.prisma.employee.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, designation: { select: { name: true } } }, orderBy: { firstName: 'asc' } }),
      this.prisma.user.findMany({ where: { tenantId, employeeId: { not: null } }, select: { employeeId: true, role: true, status: true } }),
      this.prisma.userInvite.findMany({ where: { tenantId, usedAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' } }),
    ]);
    const userBy = new Map(users.map((u) => [u.employeeId!, u]));
    const inviteBy = new Map<string, (typeof invites)[number]>();
    for (const i of invites) if (!inviteBy.has(i.employeeId)) inviteBy.set(i.employeeId, i);
    return employees.map((e) => {
      const u = userBy.get(e.id);
      const inv = inviteBy.get(e.id);
      return {
        employeeId: e.id, code: e.employeeCode, name: `${e.firstName} ${e.lastName}`, email: e.email, title: e.designation?.name ?? null,
        login: u ? 'active' : inv ? this.status(inv) : 'none',
        role: u?.role ?? inv?.role ?? null,
        inviteId: u ? null : inv?.id ?? null,
        inviteExpiresAt: u ? null : inv?.expiresAt ?? null,
      };
    });
  }

  async create(tenantId: string, actor: Actor, dto: { employeeId: string; role: InviteRole }) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId, status: 'ACTIVE' } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.email) throw new BadRequestException('Add a work email to this employee first, the invitation is sent there');
    this.assertMayGrant(actor, dto.role);

    const [hasLogin, emailTaken] = await Promise.all([
      this.prisma.user.findFirst({ where: { employeeId: employee.id }, select: { id: true } }),
      this.prisma.user.findFirst({ where: { tenantId, email: employee.email }, select: { id: true } }),
    ]);
    if (hasLogin) throw new ConflictException('This employee already has a login');
    if (emailTaken) throw new ConflictException('Another login in your company already uses this email');
    if ((ADMIN_ROLES as readonly string[]).includes(dto.role)) await assertAdminSeatRoom(this.prisma, tenantId);

    const token = randomBytes(32).toString('hex');
    const invite = await this.prisma.$transaction(async (tx) => {
      // One live invitation per employee: a new one retires the old link.
      await tx.userInvite.updateMany({ where: { employeeId: employee.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.userInvite.create({ data: { tenantId, employeeId: employee.id, email: employee.email!, role: dto.role, tokenHash: sha(token), expiresAt: new Date(Date.now() + TTL_MS), invitedById: actor.id } });
    });
    await this.sendEmail(tenantId, invite, employee.firstName, token);
    await this.audit.log({ tenantId, userId: actor.id, action: 'INVITE_SENT', entity: 'UserInvite', entityId: invite.id, after: { employeeId: employee.id, role: dto.role } });
    return this.present(invite, token);
  }

  async resend(tenantId: string, actor: Actor, id: string) {
    const inv = await this.live(tenantId, id);
    this.assertMayGrant(actor, inv.role as InviteRole);
    const token = randomBytes(32).toString('hex');
    const updated = await this.prisma.userInvite.update({ where: { id }, data: { tokenHash: sha(token), expiresAt: new Date(Date.now() + TTL_MS), sentCount: { increment: 1 } } });
    const emp = await this.prisma.employee.findUnique({ where: { id: inv.employeeId }, select: { firstName: true } });
    await this.sendEmail(tenantId, updated, emp?.firstName ?? 'there', token);
    await this.audit.log({ tenantId, userId: actor.id, action: 'INVITE_RESENT', entity: 'UserInvite', entityId: id });
    return this.present(updated, token);
  }

  async revoke(tenantId: string, actor: Actor, id: string) {
    const inv = await this.live(tenantId, id);
    this.assertMayGrant(actor, inv.role as InviteRole);
    await this.prisma.userInvite.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.audit.log({ tenantId, userId: actor.id, action: 'INVITE_REVOKED', entity: 'UserInvite', entityId: id });
    return { revoked: true };
  }

  // ── Public: the invitee ──────────────────────────────────────────────────────────────────────────
  async preview(token: string) {
    const inv = await this.byToken(token);
    const [tenant, emp] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: inv.tenantId }, select: { name: true } }),
      this.prisma.employee.findUnique({ where: { id: inv.employeeId }, select: { firstName: true, lastName: true } }),
    ]);
    return { company: tenant?.name, name: emp ? `${emp.firstName} ${emp.lastName}` : null, email: inv.email, role: inv.role };
  }

  async accept(token: string, password: string) {
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(password ?? '')) throw new BadRequestException('Password must be 8 to 72 characters with uppercase, lowercase and a number');
    const inv = await this.byToken(token);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: inv.tenantId }, select: { status: true } });
    if (tenant?.status !== 'ACTIVE') throw new BadRequestException('This invitation is no longer valid');
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      await this.prisma.$transaction(async (tx) => {
        // Claim it first: of two simultaneous accepts, exactly one gets count 1.
        const claimed = await tx.userInvite.updateMany({ where: { id: inv.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (claimed.count !== 1) throw new BadRequestException('This invitation is no longer valid');
        await tx.user.create({ data: { tenantId: inv.tenantId, employeeId: inv.employeeId, email: inv.email, passwordHash, role: inv.role, emailVerified: true, passwordChangedAt: new Date() } });
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('A login already exists for this person. Use "Forgot password" on the sign-in page.');
      throw e;
    }
    await this.audit.log({ tenantId: inv.tenantId, action: 'INVITE_ACCEPTED', entity: 'UserInvite', entityId: inv.id, after: { employeeId: inv.employeeId, role: inv.role } });
    return { message: 'Your account is ready. Sign in with your email and the password you just chose.' };
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────────────
  /** Only a company admin can hand out company-admin rights; nobody can create a platform operator. */
  private assertMayGrant(actor: Actor, role: InviteRole) {
    if (role === 'COMPANY_ADMIN' && actor.role !== 'COMPANY_ADMIN') throw new ForbiddenException('Only a company admin can invite another company admin');
  }

  private async live(tenantId: string, id: string) {
    const inv = await this.prisma.userInvite.findFirst({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.usedAt) throw new BadRequestException('This invitation was already accepted');
    if (inv.revokedAt) throw new BadRequestException('This invitation was revoked');
    return inv;
  }

  private async byToken(token: string) {
    const inv = await this.prisma.userInvite.findUnique({ where: { tokenHash: sha(token) } });
    if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt.getTime() < Date.now()) throw new BadRequestException('This invitation link is invalid or has expired');
    return inv;
  }

  private async sendEmail(tenantId: string, inv: { id: string; email: string; sentCount: number }, firstName: string, token: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    await this.outbox.enqueue({
      to: inv.email, tenantId, dedupeKey: `invite:${inv.id}:${inv.sentCount}`,
      subject: `You have been invited to ${tenant?.name ?? brandName()} on ${brandName()}`,
      body: `Hi ${firstName},\n\n${tenant?.name ?? 'Your company'} has set up a ${brandName()} account for you. Use this link to choose your password and sign in. It works once and expires in 7 days.\n\n${this.link(token)}\n\nIf you were not expecting this, you can ignore this email.\n`,
    });
  }

  /** The link is shown to HR only in development with no SMTP; in production it only ever travels by email. */
  private present(i: { id: string; employeeId: string; email: string; role: string; expiresAt: Date; sentCount: number; usedAt: Date | null; revokedAt: Date | null }, token: string) {
    const dev = process.env.NODE_ENV !== 'production' && !this.mail.configured;
    return { id: i.id, employeeId: i.employeeId, email: i.email, role: i.role, expiresAt: i.expiresAt, sentCount: i.sentCount, status: this.status(i), ...(dev ? { devLink: this.link(token) } : {}) };
  }
}
