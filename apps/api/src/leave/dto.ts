import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  policyId: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isHalfDay?: boolean;

  @IsOptional()
  @IsEnum(['morning', 'afternoon'])
  halfDayPeriod?: 'morning' | 'afternoon';

  @IsOptional()
  @IsString()
  reason?: string;
}
