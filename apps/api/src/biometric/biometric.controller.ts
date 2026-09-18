import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@matrixhr/database';
import { BiometricService } from './biometric.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { RequireFeature, Roles, TenantId } from '../common/decorators';

class CreateDeviceDto {
  @IsString() @MinLength(3) @MaxLength(64) serialNumber: string;
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
}

class UpdateDeviceDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('biometric/devices')
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
@RequireFeature('attendance.biometric')
export class BiometricAdminController {
  constructor(private biometric: BiometricService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.biometric.listDevices(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateDeviceDto) {
    return this.biometric.createDevice(tenantId, dto);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.biometric.updateDevice(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.biometric.removeDevice(tenantId, id);
  }
}

/**
 * ZKTeco "ADMS" push endpoints. These live at /iclock/* (outside /api/v1) because the
 * terminals have that path baked in. Authentication is the registered serial number —
 * the protocol has no credentials — so devices must be registered per tenant first.
 * The request body is text/plain and is captured raw in main.ts.
 */
@Controller('iclock')
export class ZktecoAdmsController {
  constructor(private biometric: BiometricService) {}

  @Get('cdata')
  @Header('Content-Type', 'text/plain')
  handshake(@Query('SN') sn: string) {
    return this.biometric.handshake(sn);
  }

  @Post('cdata')
  @Header('Content-Type', 'text/plain')
  push(@Query('SN') sn: string, @Query('table') table: string, @Req() req: { rawText?: string; body?: unknown }) {
    const body = typeof req.rawText === 'string' ? req.rawText : typeof req.body === 'string' ? req.body : '';
    return this.biometric.receive(sn, table, body);
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain')
  async getRequest(@Query('SN') sn: string) {
    await this.biometric.handshake(sn);
    return 'OK';
  }

  @Post('devicecmd')
  @Header('Content-Type', 'text/plain')
  async deviceCmd(@Query('SN') sn: string) {
    await this.biometric.handshake(sn);
    return 'OK';
  }
}
