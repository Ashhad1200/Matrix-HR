import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class GrantExtensionAccessDto {
  @IsString()
  panel: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;
}
