import { Module } from '@nestjs/common';
import { OneOnOnesController } from './oneonones.controller';
import { OneOnOnesService } from './oneonones.service';

@Module({
  controllers: [OneOnOnesController],
  providers: [OneOnOnesService],
  exports: [OneOnOnesService],
})
export class OneOnOnesModule {}
