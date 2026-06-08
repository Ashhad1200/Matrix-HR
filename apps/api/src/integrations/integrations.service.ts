import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.tenantIntegration.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const integration = await this.prisma.tenantIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }

  async findByProvider(tenantId: string, provider: string) {
    const integration = await this.prisma.tenantIntegration.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }

  async create(tenantId: string, dto: CreateIntegrationDto) {
    return this.prisma.tenantIntegration.upsert({
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
  }

  async update(tenantId: string, id: string, dto: UpdateIntegrationDto) {
    await this.findOne(tenantId, id);
    return this.prisma.tenantIntegration.update({
      where: { id },
      data: {
        status: dto.status,
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        config: dto.config as any,
      },
    });
  }

  async install(tenantId: string, provider: string) {
    return this.prisma.tenantIntegration.upsert({
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
  }
}
