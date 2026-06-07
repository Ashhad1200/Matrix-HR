import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findBySubdomain(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateBranding(tenantId: string, data: { logoUrl?: string; primaryColor?: string }) {
    return this.prisma.tenant.update({ where: { id: tenantId }, data });
  }
}
