import { IsString, IsOptional, IsEmail, IsObject } from 'class-validator';

export class CreatePreboardingInviteDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsObject()
  documents?: Record<string, unknown>;
}
