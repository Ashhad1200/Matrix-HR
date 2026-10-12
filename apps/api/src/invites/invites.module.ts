import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController, InvitePublicController } from './invites.controller';

@Module({ controllers: [InvitesController, InvitePublicController], providers: [InvitesService], exports: [InvitesService] })
export class InvitesModule {}
