import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GrantExtensionAccessDto } from './dto';

const AVAILABLE_PANELS = ['recruitment', 'it_assets', 'compliance', 'payroll', 'lms'];

@Injectable()
export class ExtensionsService {
  constructor(private prisma: PrismaService) {}

  async getPanels(tenantId: string) {
    const access = await this.prisma.extensionPanelAccess.findMany({
      where: { tenantId },
      orderBy: { panel: 'asc' },
    });

    return {
      panels: AVAILABLE_PANELS,
      access,
    };
  }

  async grantAccess(tenantId: string, dto: GrantExtensionAccessDto) {
    return this.prisma.extensionPanelAccess.create({
      data: {
        tenantId,
        panel: dto.panel,
        userId: dto.userId,
        role: dto.role,
        readOnly: dto.readOnly ?? false,
      },
    });
  }
}
