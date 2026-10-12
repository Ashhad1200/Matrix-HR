import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [UploadsController, FilesController],
  providers: [UploadsService, FilesService],
  exports: [UploadsService, FilesService],
})
export class UploadsModule {}
