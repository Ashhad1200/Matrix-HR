import { IsString, IsOptional } from 'class-validator';

export class CreateFormulaDto {
  @IsString()
  name: string;

  @IsString()
  entity: string;

  @IsString()
  expression: string;

  @IsString()
  targetField: string;
}

export class UpdateFormulaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  expression?: string;

  @IsOptional()
  @IsString()
  targetField?: string;
}
