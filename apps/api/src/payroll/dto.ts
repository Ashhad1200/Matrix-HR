import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';

const COMPENSATION_TYPES = ['ALLOWANCE', 'DEDUCTION', 'LOAN', 'ADVANCE', 'BONUS', 'ARREARS'];

export class CreateCompensationItemDto {
  @IsString()
  employeeId!: string;

  @IsIn(COMPENSATION_TYPES)
  type!: string;

  @IsString()
  label!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsString()
  startPeriod?: string;

  @IsOptional()
  @IsString()
  endPeriod?: string;
}

export class ReopenPayrollRunDto {
  @IsString()
  reason!: string;
}
