import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private whatsapp: WhatsAppService) {}

  @Post('webhook')
  handleWebhook(@Body() body: Record<string, unknown>) {
    // Direct API shape: { tenantId, from, text }
    if (typeof body.tenantId === 'string' && typeof body.from === 'string' && typeof body.text === 'string') {
      return this.whatsapp.handleIncomingMessage(body.tenantId, body.from, body.text);
    }

    // Meta Cloud API shape used in smoke tests
    const entry = (body.entry as any[])?.[0];
    const msg = entry?.changes?.[0]?.value?.messages?.[0];
    const from = msg?.from as string | undefined;
    const text = msg?.text?.body as string | undefined;
    if (from && text) {
      const tenantId = (body.tenantId as string) || process.env.DEFAULT_TENANT_ID || '';
      if (!tenantId) {
        throw new BadRequestException('tenantId required for Meta webhook payloads');
      }
      return this.whatsapp.handleIncomingMessage(tenantId, from, text);
    }

    throw new BadRequestException('Invalid WhatsApp webhook payload');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('messages')
  getMessages(@TenantId() tenantId: string) {
    return this.whatsapp.getMessageLog(tenantId);
  }
}
