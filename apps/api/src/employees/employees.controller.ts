import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { viewerOf } from '../common/data-scope';
import { CreateEmployeeDto, UpdateEmployeeDto, SelfUpdateEmployeeDto, ImportCsvDto } from './dto';
import { CreateDepartmentDto, CreateDesignationDto, AddDocumentDto } from './structure-dto';

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
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
    }, viewerOf(user));
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
  createDepartment(@TenantId() tenantId: string, @Body() body: CreateDepartmentDto) {
    return this.employees.createDepartment(tenantId, body);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  getTeam(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string) {
    return this.employees.getTeam(tenantId, employeeId);
  }

  @Get('me/payslips')
  getMyPayslips(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string) {
    return this.employees.getMyPayslips(tenantId, employeeId);
  }

  @Patch('me/self')
  selfUpdate(
    @TenantId() tenantId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: SelfUpdateEmployeeDto,
  ) {
    return this.employees.selfUpdate(tenantId, employeeId, dto);
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
    @Body() body: CreateDesignationDto,
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
  findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
  ) {
    return this.employees.findOneFor(tenantId, id, viewerOf(user));
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
    @Body() body: AddDocumentDto,
    @CurrentUser() user: { id: string; role: string; employeeId?: string },
  ) {
    return this.employees.addDocument(tenantId, employeeId, body, viewerOf(user));
  }
}
