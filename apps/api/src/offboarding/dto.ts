import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class InitiateOffboardingDto {
  /** HR/admin only — everyone else can only resign for themselves. */
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsIn(['RESIGNATION', 'TERMINATION'])
  type: 'RESIGNATION' | 'TERMINATION';

  @IsDateString()
  lastWorkingDay: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class OffboardingDecisionDto {
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ClearItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ExitInterviewDto {
  @IsString()
  @MaxLength(500)
  primaryReason: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  feedback?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsBoolean()
  wouldRecommend: boolean;
}
