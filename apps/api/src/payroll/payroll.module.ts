import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollEngineFactory } from './engines/payroll-engine.factory';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService, PayrollEngineFactory],
  exports: [PayrollService],
})
export class PayrollModule {}
