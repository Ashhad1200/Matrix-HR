import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateReportDefinitionDto {
  @IsString()
  name: string;

  @IsObject()
  config: Record<string, unknown>;
}

export class UpdateReportDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
