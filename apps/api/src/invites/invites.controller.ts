import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@matrixhr/database';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles, TenantId } from '../common/decorators';
import { InvitesService } from './invites.service';
import { AcceptInviteDto, CreateInviteDto } from './dto';

@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @Get('people') people(@TenantId() t: string) { return this.invites.people(t); }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post() create(@TenantId() t: string, @CurrentUser() u: { id: string; role: string }, @Body() dto: CreateInviteDto) { return this.invites.create(t, u, dto); }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/resend') resend(@TenantId() t: string, @CurrentUser() u: { id: string; role: string }, @Param('id') id: string) { return this.invites.resend(t, u, id); }

  @Delete(':id') revoke(@TenantId() t: string, @CurrentUser() u: { id: string; role: string }, @Param('id') id: string) { return this.invites.revoke(t, u, id); }
}

/** Unauthenticated: the invitee has no account yet. Tight rate limit; the token is 256 bits and stored hashed. */
@Controller('auth/invite')
export class InvitePublicController {
  constructor(private invites: InvitesService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token') preview(@Param('token') token: string) { return this.invites.preview(token); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept') accept(@Body() dto: AcceptInviteDto) { return this.invites.accept(dto.token, dto.password); }
}
