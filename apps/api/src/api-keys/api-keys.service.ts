import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: { id: true, name: true, prefix: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, name: string) {
    const prefix = randomBytes(4).toString('hex');
    const secret = randomBytes(24).toString('hex');
    const fullKey = `mhr_${prefix}_${secret}`;
    const keyHash = createHash('sha256').update(fullKey).digest('hex');

    const record = await this.prisma.apiKey.create({
      data: { tenantId, name, prefix, keyHash },
      select: { id: true, name: true, prefix: true, createdAt: true },
    });

    // Full key is only returned once, at creation time
    return { ...record, key: fullKey };
  }

  async revoke(tenantId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id } });
    return { revoked: true };
  }
}
