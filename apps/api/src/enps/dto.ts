import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateEnpsSurveyDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  closesAt?: string;
}

export class UpdateEnpsSurveyDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  closesAt?: string;
}

export class EnpsRespondDto {
  @IsInt()
  @Min(0)
  @Max(10)
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
