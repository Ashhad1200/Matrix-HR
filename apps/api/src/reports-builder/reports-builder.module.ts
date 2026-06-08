import { Module } from '@nestjs/common';
import { ReportsBuilderController } from './reports-builder.controller';
import { ReportsBuilderService } from './reports-builder.service';

@Module({
  controllers: [ReportsBuilderController],
  providers: [ReportsBuilderService],
  exports: [ReportsBuilderService],
})
export class ReportsBuilderModule {}
