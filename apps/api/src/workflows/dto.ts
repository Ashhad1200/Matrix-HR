import { IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsString()
  trigger: string;

  @IsArray()
  steps: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsArray()
  steps?: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateWorkflowInstanceDto {
  @IsString()
  definitionId: string;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
