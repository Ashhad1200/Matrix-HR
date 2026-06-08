import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PeerReviewsService } from './peer-reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, TenantId } from '../common/decorators';
import { UserRole } from '@matrixhr/database';
import { CreatePeerReviewDto, UpdatePeerReviewDto } from './dto';

@Controller('peer-reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
export class PeerReviewsController {
  constructor(private peerReviews: PeerReviewsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @Query('cycleId') cycleId?: string) {
    return this.peerReviews.findAll(tenantId, cycleId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.peerReviews.findOne(tenantId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreatePeerReviewDto) {
    return this.peerReviews.create(tenantId, dto);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdatePeerReviewDto) {
    return this.peerReviews.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.peerReviews.remove(tenantId, id);
  }
}
