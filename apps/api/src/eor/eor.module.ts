import { Module } from '@nestjs/common';
import { EorController } from './eor.controller';
import { EorService } from './eor.service';

@Module({
  controllers: [EorController],
  providers: [EorService],
  exports: [EorService],
})
export class EorModule {}
