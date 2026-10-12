import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCustomFieldDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, { message: 'key must be lowercase letters, numbers or _ (2-40 characters), starting with a letter' })
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  fieldType: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  fieldType?: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
