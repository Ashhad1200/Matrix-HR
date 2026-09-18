import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialCipherService } from '../crypto/credential-cipher.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

type IntegrationRow = {
  accessToken: string | null;
  refreshToken: string | null;
  [key: string]: unknown;
};

/** Credentials never leave the API — callers only learn whether one is set. */
function toPublic<T extends IntegrationRow>(row: T) {
  const { accessToken, refreshToken, ...rest } = row;
  return { ...rest, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken };
}

@Injectable()
export class IntegrationsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private cipher: CredentialCipherService,
  ) {}

  /** One-time, idempotent migration of tokens written before encryption existed. */
  async onModuleInit() {
    const legacy = await this.prisma.tenantIntegration.findMany({
      where: { OR: [{ accessToken: { not: null } }, { refreshToken: { not: null } }] },
    });
    const needsEncryption = (v: string | null) => v !== null && !this.cipher.isEncrypted(v);
    for (const row of legacy) {
      if (!needsEncryption(row.accessToken) && !needsEncryption(row.refreshToken)) continue;
      await this.prisma.tenantIntegration.update({
        where: { id: row.id },
        data: {
          accessToken: this.cipher.encrypt(row.accessToken),
          refreshToken: this.cipher.encrypt(row.refreshToken),
        },
      });
    }
  }

  async findAll(tenantId: string) {
    const rows = await this.prisma.tenantIntegration.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
    });
    return rows.map(toPublic);
  }

  async findOne(tenantId: string, id: string) {
    const integration = await this.prisma.tenantIntegration.findFirst({ where: { id, tenantId } });
    if (!integration) throw new NotFoundException('Integration not found');
    return toPublic(integration);
  }

  async findByProvider(tenantId: string, provider: string) {
    const integration = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return toPublic(integration);
  }

  /** For server-side use by provider connectors only — never expose the result over HTTP. */
  async getCredentials(tenantId: string, provider: string) {
    const row = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!row) return null;
    return {
      accessToken: this.cipher.decrypt(row.accessToken),
      refreshToken: this.cipher.decrypt(row.refreshToken),
      config: row.config as Record<string, unknown> | null,
    };
  }

  async create(tenantId: string, dto: CreateIntegrationDto) {
    const row = await this.prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: dto.provider } },
      create: {
        tenantId,
        provider: dto.provider,
        status: dto.status || 'disconnected',
        config: dto.config as any,
      },
      update: {
        status: dto.status,
        config: dto.config as any,
      },
    });
    return toPublic(row);
  }

  async update(tenantId: string, id: string, dto: UpdateIntegrationDto) {
    await this.findOne(tenantId, id);
    const row = await this.prisma.tenantIntegration.update({
      where: { id },
      data: {
        status: dto.status,
        accessToken: dto.accessToken === undefined ? undefined : this.cipher.encrypt(dto.accessToken),
        refreshToken: dto.refreshToken === undefined ? undefined : this.cipher.encrypt(dto.refreshToken),
        config: dto.config as any,
      },
    });
    return toPublic(row);
  }

  async install(tenantId: string, provider: string) {
    const row = await this.prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        status: 'connected',
        installedAt: new Date(),
        config: { stub: true, message: `${provider} install stub — configure OAuth in production` },
      },
      update: {
        status: 'connected',
        installedAt: new Date(),
      },
    });
    return toPublic(row);
  }
}
