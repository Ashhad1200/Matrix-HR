import { Controller, Get } from '@nestjs/common';
import { brand } from '../common/brand';

/** Public: the login page needs the product name, logo and colour before anyone is signed in. */
@Controller('brand')
export class BrandController {
  @Get()
  get() {
    const b = brand();
    return { whiteLabel: b.whiteLabel, name: b.name, logoUrl: b.logoUrl, faviconUrl: b.faviconUrl, primaryColor: b.primaryColor, supportEmail: b.supportEmail, websiteUrl: b.websiteUrl };
  }
}
