import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CredentialCipherService } from '../crypto/credential-cipher.service';
import { MailService } from '../mail/mail.service';
import { base32Encode, generateSecret, otpauthUrl, verifyTotp } from './totp';
import { DEFAULT_LEAVE_POLICIES, getPermissionsForRole } from '@matrixhr/shared';
import { SignUpDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private entitlements: EntitlementsService,
    private cipher: CredentialCipherService,
    private mail: MailService,
  ) {}

  async signUp(dto: SignUpDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    if (existing) throw new ConflictException('Subdomain already taken');

    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.companyName,
        subdomain: dto.subdomain,
        users: {
          create: {
            email: dto.email,
            passwordHash,
            role: 'COMPANY_ADMIN',
            emailVerified: true,
          },
        },
      },
      include: { users: true },
    });

    for (const policy of DEFAULT_LEAVE_POLICIES) {
      await this.prisma.leavePolicy.create({
        data: { tenantId: tenant.id, ...policy, accrualType: 'yearly' },
      });
    }

    await this.prisma.shift.create({
      data: {
        tenantId: tenant.id,
        name: 'Flexible 8-Hour',
        type: 'flexible',
        workingHours: 8,
      },
    });

    const user = tenant.users[0];
    const tokens = await this.generateTokens(user.id, tenant.id, user.role, user.tokenVersion);
    // Without a session row the refresh token issued here could never be redeemed.
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: AuthService.tokenHash(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: 'CREATE',
      entity: 'Tenant',
      entityId: tenant.id,
      after: { name: tenant.name, subdomain: tenant.subdomain },
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      user: { id: user.id, email: user.email, role: user.role },
      ...tokens,
    };
  }

  // ── Login / sessions ──────────────────────────────────────────────────────
  // Refresh tokens are long, random-ish JWTs: bcrypt would only look at the first 72 bytes (identical for
  // every token of a user), so sessions are matched by SHA-256 of the whole token instead.
  private static tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');

  private static readonly DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
  private static readonly MAX_ATTEMPTS = 5;

  private mfaSecret() {
    return `${this.config.get('JWT_SECRET', 'dev-secret-change-in-production')}:mfa`;
  }

  private async registerFailure(user: { id: string; failedAttempts: number }) {
    const attempts = user.failedAttempts + 1;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: attempts,
        lockedUntil: attempts >= AuthService.MAX_ATTEMPTS ? new Date(Date.now() + 30 * 60 * 1000) : null,
      },
    });
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        ...(dto.tenantId ? { tenantId: dto.tenantId } : {}),
      },
      include: { tenant: true },
    });

    if (!user) {
      // Spend the same time as a real check so response time doesn't reveal which emails exist.
      await bcrypt.compare(dto.password, AuthService.DUMMY_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.registerFailure(user);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('This account is disabled');
    }

    if (user.twoFaEnabled) {
      // Password is right but the session isn't issued until the second factor is proven.
      const mfaToken = await this.jwt.signAsync({ sub: user.id, purpose: 'mfa' }, { secret: this.mfaSecret(), expiresIn: '5m' });
      return { mfaRequired: true as const, mfaToken };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
    return this.issueSession(user, ip);
  }

  private async issueSession(
    user: { id: string; email: string; role: string; tenantId: string; employeeId: string | null; tokenVersion: number; tenant: { id: string; name: string; subdomain: string } },
    ip?: string,
  ) {
    const tokens = await this.generateTokens(user.id, user.tenantId, user.role, user.tokenVersion);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: AuthService.tokenHash(tokens.refreshToken),
        ipAddress: ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: ip });
    return {
      user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, employeeId: user.employeeId },
      tenant: { id: user.tenant.id, name: user.tenant.name, subdomain: user.tenant.subdomain },
      ...tokens,
    };
  }

  /** Refresh tokens rotate: each is valid once, so a stolen copy stops working as soon as the real client refreshes. */
  async refresh(refreshToken: string) {
    let payload: { sub: string; tenantId: string; role: string; tv?: number };
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret') });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } });
    if (!user || user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE' || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matched = await this.prisma.session.findFirst({
      where: { userId: user.id, refreshTokenHash: AuthService.tokenHash(refreshToken), expiresAt: { gt: new Date() } },
    });
    if (!matched) throw new UnauthorizedException('Invalid refresh token');

    // Use the role from the database, not the (possibly stale) token, so demotions apply on refresh.
    const tokens = await this.generateTokens(user.id, user.tenantId, user.role, user.tokenVersion);
    await this.prisma.session.update({
      where: { id: matched.id },
      data: { refreshTokenHash: AuthService.tokenHash(tokens.refreshToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    return tokens;
  }

  async logout(refreshToken: string) {
    let sub: string;
    try {
      sub = this.jwt.verify(refreshToken, { secret: this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret') }).sub;
    } catch {
      return { success: true };
    }
    await this.prisma.session.deleteMany({ where: { userId: sub, refreshTokenHash: AuthService.tokenHash(refreshToken) } });
    return { success: true };
  }

  // ── Password reset / change ───────────────────────────────────────────────
  private static readonly RESET_TTL_MS = 30 * 60 * 1000;
  private static sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

  /** Always answers the same way so the endpoint can't be used to discover which emails have accounts. */
  async forgotPassword(email: string) {
    const generic = { message: 'If an account exists for that email, a reset link has been sent.' };
    const user = await this.prisma.user.findFirst({ where: { email }, include: { tenant: true } });
    if (!user || user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') return generic;

    const token = randomBytes(32).toString('hex');
    // Only the hash is stored, and a new request overwrites (invalidates) any earlier link.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: AuthService.sha256(token), passwordResetExpires: new Date(Date.now() + AuthService.RESET_TTL_MS) },
    });
    const base = (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
    await this.mail.send({
      to: user.email,
      subject: 'Reset your MatrixHR password',
      text: `Use this link to choose a new password. It works once and expires in 30 minutes.\n\n${base}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'PASSWORD_RESET_REQUESTED', entity: 'User', entityId: user.id });
    return generic;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: AuthService.sha256(token), passwordResetExpires: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('This reset link is invalid or has expired');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          passwordResetToken: null, // single use
          passwordResetExpires: null,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
          failedAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'PASSWORD_RESET_COMPLETED', entity: 'User', entityId: user.id });
    return { message: 'Password updated. Please sign in with your new password.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log({ tenantId: user.tenantId, userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
    // Every other device is signed out; this one gets a fresh session.
    return this.issueSession({ ...user, tokenVersion: updated.tokenVersion }, ip);
  }

  // ── Multi-factor (TOTP) ───────────────────────────────────────────────────
  async mfaSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.twoFaEnabled) throw new BadRequestException('Two-factor authentication is already enabled');
    const secret = generateSecret();
    // Stored encrypted, and inactive until the user proves their app works via mfaEnable.
    await this.prisma.user.update({ where: { id: userId }, data: { twoFaSecret: this.cipher.encrypt(secret) } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  async mfaEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFaSecret) throw new BadRequestException('Start setup first');
    if (user.twoFaEnabled) throw new BadRequestException('Two-factor authentication is already enabled');
    const step = verifyTotp(this.cipher.decrypt(user.twoFaSecret)!, code.trim());
    if (step === null) throw new BadRequestException('That code is not valid — check your authenticator app and try again');

    const recoveryCodes = Array.from({ length: 8 }, () => {
      const raw = base32Encode(randomBytes(7)).slice(0, 10);
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: true, twoFaLastStep: step, twoFaRecoveryCodes: recoveryCodes.map((c) => AuthService.sha256(c)) },
    });
    await this.audit.log({ tenantId: user.tenantId, userId, action: 'MFA_ENABLED', entity: 'User', entityId: userId });
    // Shown once — only hashes are kept.
    return { recoveryCodes };
  }

  /** Accepts an authenticator code or a single-use recovery code; returns true and records the use if valid. */
  private async consumeSecondFactor(
    user: { id: string; twoFaSecret: string | null; twoFaLastStep: number | null; twoFaRecoveryCodes: string[] },
    code: string,
  ): Promise<boolean> {
    const trimmed = code.trim();
    if (/^\d{6}$/.test(trimmed) && user.twoFaSecret) {
      const step = verifyTotp(this.cipher.decrypt(user.twoFaSecret)!, trimmed, { lastStep: user.twoFaLastStep });
      if (step === null) return false;
      await this.prisma.user.update({ where: { id: user.id }, data: { twoFaLastStep: step } });
      return true;
    }
    const hash = AuthService.sha256(trimmed.toUpperCase());
    if (!user.twoFaRecoveryCodes.includes(hash)) return false;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFaRecoveryCodes: user.twoFaRecoveryCodes.filter((h) => h !== hash) },
    });
    return true;
  }

  async mfaVerify(mfaToken: string, code: string, ip?: string) {
    let sub: string;
    try {
      const payload = this.jwt.verify(mfaToken, { secret: this.mfaSecret() });
      if (payload.purpose !== 'mfa') throw new Error('wrong token');
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Your sign-in expired — start again');
    }
    const user = await this.prisma.user.findUnique({ where: { id: sub }, include: { tenant: true } });
    if (!user || !user.twoFaEnabled) throw new UnauthorizedException('Your sign-in expired — start again');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException('Account locked. Try again later.');
    if (user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') throw new UnauthorizedException('This account is disabled');

    // A 6-digit code is guessable, so wrong codes count toward the same lockout as wrong passwords.
    if (!(await this.consumeSecondFactor(user, code))) {
      await this.registerFailure(user);
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
    return this.issueSession(user, ip);
  }

  async mfaDisable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFaEnabled) throw new BadRequestException('Two-factor authentication is not enabled');
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Password is incorrect');
    if (!(await this.consumeSecondFactor(user, code))) throw new UnauthorizedException('Invalid authentication code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: false, twoFaSecret: null, twoFaLastStep: null, twoFaRecoveryCodes: [] },
    });
    await this.audit.log({ tenantId: user.tenantId, userId, action: 'MFA_DISABLED', entity: 'User', entityId: userId });
    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, employee: { include: { department: true, designation: true } } },
    });
    if (!user) return null;

    const pendingApprovals = user.employeeId
      ? await this.prisma.leaveRequest.count({
          where: {
            tenantId: user.tenantId,
            status: 'PENDING',
            ...(user.role === 'MANAGER' ? { approverId: user.employeeId } : {}),
          },
        })
      : 0;

    const unreadNotifications = await this.prisma.notification.count({
      where: { tenantId: user.tenantId, userId: user.id, read: false },
    });

    const permissions = getPermissionsForRole(user.role);
    const nav = permissions.nav.map((item) =>
      item.badge === 'pendingApprovals' && pendingApprovals > 0
        ? { ...item, badgeCount: pendingApprovals }
        : item,
    );

    const entitlements =
      user.role === 'SUPER_ADMIN' ? null : await this.entitlements.resolve(user.tenantId);

    // Credential material (password hash, 2FA secret/recovery codes, reset/verify tokens, lockout
    // counters) must never be serialised to a client — only the facts the UI needs.
    const {
      passwordHash: _ph, twoFaSecret: _ts, twoFaRecoveryCodes: _rc, twoFaLastStep: _ls,
      emailVerifyToken: _ev, passwordResetToken: _pr, passwordResetExpires: _pe,
      failedAttempts: _fa, lockedUntil: _lu, ...safe
    } = user;

    return {
      ...safe,
      permissions: { ...permissions, nav },
      badges: { pendingApprovals, unreadNotifications },
      entitlements,
    };
  }

  private async generateTokens(userId: string, tenantId: string, role: string, tokenVersion = 0) {
    const payload = { sub: userId, tenantId, role, tv: tokenVersion };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      // A random jti makes every refresh token unique even when minted within the same second.
      this.jwt.signAsync(payload, {
        jwtid: randomUUID(),
        secret: this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
