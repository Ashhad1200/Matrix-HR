import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PayrollEngine } from './payroll-engine.interface';
import { PkPayrollEngine } from './pk-payroll.engine';
import { UsPayrollEngine } from './us-payroll.engine';

@Injectable()
export class PayrollEngineFactory {
  private readonly pkEngine = new PkPayrollEngine();
  private readonly usEngine = new UsPayrollEngine();

  constructor(private prisma: PrismaService) {}

  async getEngine(tenantId: string): Promise<PayrollEngine> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true, timezone: true },
    });

    if (!tenant) return this.pkEngine;

    const integration = await this.prisma.tenantIntegration.findFirst({
      where: { tenantId, provider: 'tenant_config' },
      select: { config: true },
    });

    const config = integration?.config as { country?: string } | null;
    const isUs =
      config?.country === 'US' ||
      tenant.currency === 'USD' ||
      tenant.timezone?.startsWith('America/');

    return isUs ? this.usEngine : this.pkEngine;
  }
}
