import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SyncRecord = {
  tenantId: string;
  provider: string;
  direction: 'INBOUND' | 'OUTBOUND';
  processed: number;
  failed: number;
  message?: string;
  details?: Record<string, unknown>;
  startedAt?: Date;
};

@Injectable()
export class IntegrationSyncService {
  constructor(private prisma: PrismaService) {}

  async record(r: SyncRecord) {
    const status = r.failed === 0 ? 'SUCCESS' : r.processed > 0 ? 'PARTIAL' : 'FAILED';
    return this.prisma.integrationSyncLog.create({
      data: {
        tenantId: r.tenantId,
        provider: r.provider,
        direction: r.direction,
        status,
        recordsProcessed: r.processed,
        recordsFailed: r.failed,
        message: r.message,
        details: r.details as any,
        startedAt: r.startedAt ?? new Date(),
      },
    });
  }

  list(tenantId: string, provider: string, limit = 50) {
    return this.prisma.integrationSyncLog.findMany({
      where: { tenantId, provider },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /** Most recent run per provider — drives the health badge in the marketplace. */
  async latestByProvider(tenantId: string) {
    const rows = await this.prisma.integrationSyncLog.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      distinct: ['provider'],
    });
    return new Map(rows.map((r) => [r.provider, r]));
  }
}
