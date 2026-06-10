import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { EnpsService } from './enps.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateEnpsSurveyDto, UpdateEnpsSurveyDto, EnpsRespondDto } from './dto';

@Controller('enps/surveys')
export class EnpsController {
  constructor(private enps: EnpsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.enps.findAll(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('summary')
  getSummary(@TenantId() tenantId: string) {
    return this.enps.getSummary(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.enps.findOne(tenantId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateEnpsSurveyDto) {
    return this.enps.create(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateEnpsSurveyDto) {
    return this.enps.update(tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.enps.remove(tenantId, id);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() dto: EnpsRespondDto) {
    return this.enps.respond(id, dto);
  }
}
