import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OneOnOnesService } from './oneonones.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateOneOnOneDto, UpdateOneOnOneDto } from './dto';

@Controller('one-on-ones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class OneOnOnesController {
  constructor(private oneOnOnes: OneOnOnesService) {}

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.oneOnOnes.findAll(tenantId, employeeId, role);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: CreateOneOnOneDto,
  ) {
    return this.oneOnOnes.create(tenantId, employeeId, dto);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateOneOnOneDto,
  ) {
    return this.oneOnOnes.update(tenantId, id, employeeId, role, dto);
  }

  @Delete(':id')
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.oneOnOnes.remove(tenantId, id, employeeId, role);
  }
}
