import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get('logs')
  getLogs(
    @TenantId() tenantId: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));

    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });
  }
}
