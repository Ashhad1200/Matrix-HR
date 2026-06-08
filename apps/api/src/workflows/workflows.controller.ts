import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto';

@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class WorkflowsController {
  constructor(private workflows: WorkflowsService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.workflows.findAll(tenantId);
  }

  @Get('instances')
  getInstances(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.workflows.getInstances(tenantId, status);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.workflows.findOne(tenantId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(tenantId, dto);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflows.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.workflows.remove(tenantId, id);
  }
}
