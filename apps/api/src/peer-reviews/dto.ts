import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreatePeerReviewDto {
  @IsString()
  cycleId: string;

  @IsString()
  employeeId: string;

  @IsString()
  reviewerId: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

export class UpdatePeerReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
