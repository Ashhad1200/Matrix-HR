import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EorService } from './eor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { UserRole } from '@matrixhr/database';

@Controller('eor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN)
export class EorController {
  constructor(private eor: EorService) {}

  @Get('countries')
  getCountries() {
    return this.eor.getCountries();
  }

  @Get('quote')
  getQuote(@Query('country') country: string, @Query('salary') salary: string) {
    return this.eor.getQuote(country, Number(salary));
  }
}
