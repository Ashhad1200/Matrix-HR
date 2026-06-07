import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_LEAVE_POLICIES } from '@matrixhr/shared';
import { SignUpDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
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
    const tokens = await this.generateTokens(user.id, tenant.id, user.role);

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

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        ...(dto.tenantId ? { tenantId: dto.tenantId } : {}),
      },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const tokens = await this.generateTokens(user.id, user.tenantId, user.role);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
        ipAddress: ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        employeeId: user.employeeId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; tenantId: string; role: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const sessions = await this.prisma.session.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
    });

    let validSession = false;
    for (const session of sessions) {
      if (await bcrypt.compare(refreshToken, session.refreshTokenHash)) {
        validSession = true;
        break;
      }
    }

    if (!validSession) throw new UnauthorizedException('Invalid refresh token');

    return this.generateTokens(payload.sub, payload.tenantId, payload.role as any);
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, employee: { include: { department: true, designation: true } } },
    });
  }

  private async generateTokens(userId: string, tenantId: string, role: string) {
    const payload = { sub: userId, tenantId, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
