import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollEngineFactory } from './engines/payroll-engine.factory';
import { PayslipPdfService } from './payslip-pdf.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollEngineFactory, PayslipPdfService],
  exports: [PayrollService],
})
export class PayrollModule {}
