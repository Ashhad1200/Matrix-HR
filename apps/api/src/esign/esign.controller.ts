import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { EsignService } from './esign.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateEsignRequestDto } from './dto';

@Controller('esign')
@UseGuards(JwtAuthGuard)
export class EsignController {
  constructor(private esign: EsignService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('requests')
  createRequest(@TenantId() tenantId: string, @Body() dto: CreateEsignRequestDto) {
    return this.esign.createRequest(tenantId, dto);
  }

  @Patch(':id/sign')
  sign(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.esign.sign(tenantId, id);
  }
}
