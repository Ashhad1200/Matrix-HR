import { Body, Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { UserRole } from '@matrixhr/database';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { BillingService } from './billing.service';
import { CreateRequestDto, UploadProofDto } from './dto';
import { PROOF_MAX_BYTES } from './billing.config';

/** Tenant-facing billing. Only company admins and HR managers may use it; every lookup is scoped to the caller's tenant. */
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER)
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('state') state(@TenantId() t: string) { return this.billing.state(t); }
  @Get('catalog') catalog(@TenantId() t: string) { return this.billing.catalog(t); }

  @Post('quote')
  quote(@TenantId() t: string, @Body() dto: Omit<CreateRequestDto, 'accountId'>) { return this.billing.quote(t, dto); }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('requests')
  create(@TenantId() t: string, @CurrentUser('id') u: string, @Body() dto: CreateRequestDto) { return this.billing.createRequest(t, u, dto); }

  @Get('requests') list(@TenantId() t: string) { return this.billing.listRequests(t); }
  @Get('requests/:id') one(@TenantId() t: string, @Param('id') id: string) { return this.billing.getRequest(t, id); }
  @Post('requests/:id/cancel') cancel(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string) { return this.billing.cancelRequest(t, u, id); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('requests/:id/proof')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PROOF_MAX_BYTES, files: 1 } })) // memory storage: bytes go to the database, never to disk or the public bucket
  proof(@TenantId() t: string, @CurrentUser('id') u: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: UploadProofDto) {
    return this.billing.uploadProof(t, u, id, file, body);
  }

  @Get('requests/:id/proof')
  async proofBytes(@TenantId() t: string, @Param('id') id: string, @Res() res: Response) {
    const p = await this.billing.proofFor(t, id);
    sendProof(res, p);
  }

  @Get('requests/:id/receipt') receipt(@TenantId() t: string, @Param('id') id: string) { return this.billing.receipt(t, id); }
}

export function sendProof(res: Response, p: { mime: string; filename: string | null; data: Uint8Array }) {
  res.setHeader('Content-Type', p.mime);
  res.setHeader('Content-Disposition', `inline; filename="${(p.filename ?? 'proof').replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.end(Buffer.from(p.data));
}
