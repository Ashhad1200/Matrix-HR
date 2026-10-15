import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { IngestController } from './ingest.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringWorker } from './monitoring.worker';
import { DeviceTokenGuard } from './device-token.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [MonitoringController, IngestController],
  providers: [MonitoringService, MonitoringWorker, DeviceTokenGuard],
  exports: [MonitoringService, MonitoringWorker],
})
export class MonitoringModule {}
