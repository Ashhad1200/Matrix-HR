import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ReportsBuilderService } from './reports-builder.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateReportDefinitionDto, UpdateReportDefinitionDto } from './dto';

@Controller('report-definitions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class ReportsBuilderController {
  constructor(private reportsBuilder: ReportsBuilderService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.reportsBuilder.findAll(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.reportsBuilder.findOne(tenantId, id);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReportDefinitionDto,
  ) {
    return this.reportsBuilder.create(tenantId, userId, dto);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateReportDefinitionDto) {
    return this.reportsBuilder.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.reportsBuilder.remove(tenantId, id);
  }
}
