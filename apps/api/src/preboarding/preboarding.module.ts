import { Module } from '@nestjs/common';
import { PreboardingController } from './preboarding.controller';
import { PreboardingService } from './preboarding.service';

@Module({
  controllers: [PreboardingController],
  providers: [PreboardingService],
  exports: [PreboardingService],
})
export class PreboardingModule {}
