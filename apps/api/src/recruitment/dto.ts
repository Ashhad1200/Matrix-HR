import { IsEmail, IsOptional, IsString, IsUrl, MaxLength, IsIn, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsString() @MaxLength(10000) requirements?: string;
}

export class CreateApplicationDto {
  @IsString() jobId: string;
  @IsString() @MaxLength(100) firstName: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsUrl({ require_protocol: true, require_tld: false }) resumeUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) source?: string;
}

export class HireDto {
  /** Also invite the new hire to sign in, with this role. */
  @IsOptional() @IsIn(['EMPLOYEE', 'MANAGER', 'HR_MANAGER', 'COMPANY_ADMIN']) inviteRole?: 'EMPLOYEE' | 'MANAGER' | 'HR_MANAGER' | 'COMPANY_ADMIN';
}
