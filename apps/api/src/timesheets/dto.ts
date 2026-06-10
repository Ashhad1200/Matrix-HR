import { IsString, IsOptional, IsDateString, IsNumber, Min, Max, IsIn } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;
}

export class CreateTimeEntryDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours!: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours?: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitWeekDto {
  @IsDateString()
  weekStart!: string;
}

export class RejectEntryDto {
  @IsOptional()
  @IsIn(['rejected'])
  status?: string;
}
