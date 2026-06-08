import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PreboardingService } from './preboarding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreatePreboardingInviteDto } from './dto';

@Controller('preboarding')
export class PreboardingController {
  constructor(private preboarding: PreboardingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post('invite')
  createInvite(@TenantId() tenantId: string, @Body() dto: CreatePreboardingInviteDto) {
    return this.preboarding.createInvite(tenantId, dto);
  }

  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.preboarding.getByToken(token);
  }
}
