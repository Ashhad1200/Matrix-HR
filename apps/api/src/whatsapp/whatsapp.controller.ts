import {
  Body, Controller, ForbiddenException, Get, HttpCode, Post, Put, Query, RawBodyRequest, Req,
  ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

class SetConsentDto {
  @IsString() @MaxLength(30) phone: string;
  @IsIn(['OPTED_IN', 'OPTED_OUT']) status: 'OPTED_IN' | 'OPTED_OUT';
}

class SetMyConsentDto {
  @IsIn(['OPTED_IN', 'OPTED_OUT']) status: 'OPTED_IN' | 'OPTED_OUT';
}

export function signatureValid(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.slice('sha256='.length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private whatsapp: WhatsAppService) {}

  /** Meta's one-time subscription handshake. */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!expected) throw new ServiceUnavailableException('WhatsApp webhook is not configured');
    if (mode !== 'subscribe' || token !== expected) throw new ForbiddenException();
    return challenge ?? '';
  }

  /**
   * Public endpoint, so authenticity is the whole game: every request must carry Meta's HMAC over the
   * exact bytes we received, keyed by our app secret. Unsigned/forged requests never reach any handler —
   * and there is deliberately no "trusted direct" payload shape any more.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Req() req: RawBodyRequest<{ headers: Record<string, string | undefined>; body: any }>) {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) throw new ServiceUnavailableException('WhatsApp webhook is not configured');
    if (!signatureValid(req.rawBody, req.headers['x-hub-signature-256'], appSecret)) {
      throw new ForbiddenException('Invalid signature');
    }

    for (const entry of req.body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        const tenantId = await this.whatsapp.resolveTenant(value?.metadata?.phone_number_id);
        if (!tenantId) continue; // a number we don't serve — acknowledge so Meta doesn't retry
        for (const m of value?.messages ?? []) {
          if (m?.type === 'text' && m.from && m.text?.body && m.id) {
            await this.whatsapp.handleInbound(tenantId, { id: m.id, from: m.from, text: m.text.body });
          }
        }
      }
    }
    return { received: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('messages')
  getMessages(@TenantId() tenantId: string) {
    return this.whatsapp.getMessageLog(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Get('consents')
  consents(@TenantId() tenantId: string) {
    return this.whatsapp.listConsents(tenantId);
  }

  /** HR recording consent they collected elsewhere (e.g. a signed form) — labelled as such in the record. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
  @Put('consents')
  setConsent(@TenantId() tenantId: string, @Body() dto: SetConsentDto) {
    return this.whatsapp.setConsent(tenantId, dto.phone, dto.status, 'ADMIN_ATTESTED');
  }

  @UseGuards(JwtAuthGuard)
  @Get('consent/me')
  myConsent(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string) {
    return this.whatsapp.myConsent(tenantId, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('consent/me')
  setMyConsent(@TenantId() tenantId: string, @CurrentUser('employeeId') employeeId: string, @Body() dto: SetMyConsentDto) {
    return this.whatsapp.setMyConsent(tenantId, employeeId, dto.status);
  }
}
