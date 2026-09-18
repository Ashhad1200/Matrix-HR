import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsBoolean() isMandatory?: boolean;
}

export class EnrollDto {
  @IsString() courseId: string;
  /** HR/admin only. Everyone else can only enrol themselves. */
  @IsOptional() @IsString() employeeId?: string;
}

export class UpdateProgressDto {
  @IsInt() @Min(0) @Max(100) progress: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) score?: number;
}
