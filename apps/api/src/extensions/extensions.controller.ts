import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { GrantExtensionAccessDto } from './dto';

@Controller('extensions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class ExtensionsController {
  constructor(private extensions: ExtensionsService) {}

  @Get('panels')
  getPanels(@TenantId() tenantId: string) {
    return this.extensions.getPanels(tenantId);
  }

  @Post('access')
  grantAccess(@TenantId() tenantId: string, @Body() dto: GrantExtensionAccessDto) {
    return this.extensions.grantAccess(tenantId, dto);
  }
}
