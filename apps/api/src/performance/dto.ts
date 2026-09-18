import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCycleDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsIn(['quarterly', 'annual', 'half-yearly', 'monthly']) type?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

export class CreateGoalDto {
  /** Non-HR callers may only set goals for themselves (or, for managers, their reports). */
  @IsOptional() @IsString() employeeId?: string;
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() cycleId?: string;
}

export class UpdateGoalProgressDto {
  @IsNumber() @Min(0) @Max(100) progress: number;
}

export class CreateReviewDto {
  @IsString() cycleId: string;
  @IsString() employeeId: string;
  @IsString() reviewerId: string;
}

export class SubmitReviewDto {
  @IsOptional() @IsInt() @Min(1) @Max(5) selfRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) managerRating?: number;
  @IsOptional() @IsString() @MaxLength(4000) feedback?: string;
  @IsOptional() @IsIn(['pending', 'in_progress', 'submitted']) status?: string;
}
