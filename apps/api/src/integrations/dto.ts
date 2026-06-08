import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  provider: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
