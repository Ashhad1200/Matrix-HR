import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole } from '@matrixhr/database';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { AssistantService } from './assistant.service';
import { AiSettingsService, AiSettingsInput } from './ai-settings.service';
import { ATTACH_MAX_BYTES, extractAttachment } from './extract';

class ChatDto {
  @IsOptional() @IsString() @MaxLength(4000) message?: string;
  @IsOptional() @IsString() @MaxLength(60) conversationId?: string;
}
class ToggleDto { @IsBoolean() enabled: boolean; }

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private assistant: AssistantService) {}

  @Get('status') status(@TenantId() t: string) { return this.assistant.status(t); }

  @Get('tenant') @UseGuards(RolesGuard) @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  tenant(@TenantId() t: string) { return this.assistant.tenantFlag(t); }
  @Put('tenant') @UseGuards(RolesGuard) @Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
  setTenant(@TenantId() t: string, @CurrentUser('id') u: string, @Body() dto: ToggleDto) { return this.assistant.setTenantEnabled(t, u, dto.enabled); }

  @Post('chat')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ATTACH_MAX_BYTES, files: 1 } })) // memory storage: nothing is written to disk
  async chat(@TenantId() t: string, @CurrentUser() u: any, @Body() dto: ChatDto, @UploadedFile() file?: Express.Multer.File) {
    const attachment = file ? await extractAttachment(file) : undefined;
    return this.assistant.chat(t, { id: u.id, role: u.role, employeeId: u.employeeId }, { message: dto.message ?? '', conversationId: dto.conversationId, attachment });
  }

  @Get('conversations') list(@TenantId() t: string, @CurrentUser('id') u: string) { return this.assistant.listConversations(t, u); }
  @Get('conversations/:id') one(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string) { return this.assistant.getConversation(t, u, id); }
  @Delete('conversations/:id') del(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string) { return this.assistant.deleteConversation(t, u, id); }

  @Post('actions/:id/confirm') confirm(@TenantId() t: string, @CurrentUser() u: any, @Param('id') id: string) { return this.assistant.confirm(t, { id: u.id, role: u.role, employeeId: u.employeeId }, id); }
  @Post('actions/:id/cancel') cancel(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string) { return this.assistant.cancel(t, u, id); }
}

/** Operator-only AI configuration. Keys go in, never come out. */
@Controller('platform/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AiAdminController {
  constructor(private settings: AiSettingsService) {}
  @Get('settings') get() { return this.settings.view(); }
  @Put('settings') put(@CurrentUser('id') op: string, @Body() dto: AiSettingsInput) { return this.settings.update(op, dto); }
}
