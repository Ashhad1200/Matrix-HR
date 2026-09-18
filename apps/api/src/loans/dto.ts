import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateLoanDto {
  @IsIn(['LOAN', 'ADVANCE']) type: 'LOAN' | 'ADVANCE';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100_000_000) amount: number;
  /** Ignored for ADVANCE (always one instalment). */
  @IsOptional() @IsInt() @Min(1) @Max(36) installments?: number;
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'firstDeductionPeriod must look like 2026-11' }) firstDeductionPeriod: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class LoanDecisionDto {
  @IsIn(['APPROVE', 'REJECT']) action: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
