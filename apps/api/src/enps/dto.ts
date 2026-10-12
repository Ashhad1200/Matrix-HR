import { IsString, IsOptional, IsInt, IsIn, IsDateString, Min, Max, MaxLength, MinLength } from 'class-validator';

export class CreateEnpsSurveyDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(500)
  question?: string;

  @IsOptional() @IsDateString()
  closesAt?: string;
}

export class UpdateEnpsSurveyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(500)
  question?: string;

  @IsOptional() @IsIn(['draft', 'active', 'closed'])
  status?: string;

  @IsOptional() @IsDateString()
  closesAt?: string;
}

export class EnpsRespondDto {
  @IsInt()
  @Min(0)
  @Max(10)
  score: number;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}
