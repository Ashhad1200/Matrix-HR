import { Module } from '@nestjs/common';
import { EnpsController } from './enps.controller';
import { EnpsService } from './enps.service';

@Module({
  controllers: [EnpsController],
  providers: [EnpsService],
  exports: [EnpsService],
})
export class EnpsModule {}
