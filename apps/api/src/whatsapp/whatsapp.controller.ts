import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private whatsapp: WhatsAppService) {}

  @Post('webhook')
  handleWebhook(@Body() body: { tenantId: string; from: string; text: string }) {
    return this.whatsapp.handleIncomingMessage(body.tenantId, body.from, body.text);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('messages')
  getMessages(@TenantId() tenantId: string) {
    return this.whatsapp.getMessageLog(tenantId);
  }
}
