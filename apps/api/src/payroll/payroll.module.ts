import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollEngineFactory } from './engines/payroll-engine.factory';
import { PayslipPdfService } from './payslip-pdf.service';
import { UploadsModule } from '../uploads/uploads.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [UploadsModule, IntegrationsModule, EntitlementsModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollEngineFactory, PayslipPdfService],
  exports: [PayrollService],
})
export class PayrollModule {}
