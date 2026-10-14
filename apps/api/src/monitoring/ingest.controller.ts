import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MonitoringService } from './monitoring.service';
import { DeviceTokenGuard } from './device-token.guard';
import { IngestDto } from './dto';

/**
 * The desktop agent posts here with its device token (header X-Device-Token) — NOT a user JWT.
 * Time and activity counts only; the server drops app/domain if the tenant turned those off.
 */
@Controller('activity')
export class IngestController {
  constructor(private monitoring: MonitoringService) {}

  @UseGuards(DeviceTokenGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('ingest')
  ingest(@Req() req: any, @Body() dto: IngestDto) {
    return this.monitoring.ingest(req.device, dto);
  }
}
