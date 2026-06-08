import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreateEmployeeDto, UpdateEmployeeDto, ImportCsvDto } from './dto';

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.employees.findAll(tenantId, {
      departmentId, status, search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('org-chart')
  getOrgChart(@TenantId() tenantId: string) {
    return this.employees.getOrgChart(tenantId);
  }

  @Get('departments')
  getDepartments(@TenantId() tenantId: string) {
    return this.employees.getDepartments(tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  @Post('departments')
  createDepartment(@TenantId() tenantId: string, @Body() body: { name: string; parentId?: string }) {
    return this.employees.createDepartment(tenantId, body);
  }

  @Get('designations')
  getDesignations(@TenantId() tenantId: string) {
    return this.employees.getDesignations(tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  @Post('designations')
  createDesignation(
    @TenantId() tenantId: string,
    @Body() body: { name: string; grade?: string; departmentId?: string },
  ) {
    return this.employees.createDesignation(tenantId, body);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  @Post('import')
  importCsv(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ImportCsvDto,
  ) {
    return this.employees.importCsv(tenantId, userId, dto.rows);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.employees.findOne(tenantId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employees.create(tenantId, userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(tenantId, userId, id, dto);
  }

  @Post(':id/documents')
  addDocument(
    @TenantId() tenantId: string,
    @Param('id') employeeId: string,
    @Body() body: { type: string; name: string; fileUrl: string; expiryDate?: string },
  ) {
    return this.employees.addDocument(tenantId, employeeId, body);
  }
}
