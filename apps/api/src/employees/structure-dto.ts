import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() parentId?: string;
}

export class CreateDesignationDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(20) grade?: string;
  @IsOptional() @IsString() departmentId?: string;
}

export class AddDocumentDto {
  @IsString() @MaxLength(60) type: string;
  @IsString() @MinLength(1) @MaxLength(200) name: string;
  /** Key returned by POST /uploads for this tenant. */
  @IsOptional() @IsString() @MaxLength(300) fileKey?: string;
  /** Legacy: a URL into our own bucket. Anything else is refused by the service. */
  @IsOptional() @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }) fileUrl?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  /** A department id, or null to make it a top-level department. */
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() parentId?: string | null;
}

export class UpdateDesignationDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MaxLength(20) grade?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() departmentId?: string | null;
}

export class ImportDepartmentRowDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  /** Name of the parent department (it may be created earlier in the same import). */
  @IsOptional() @IsString() @MaxLength(120) parent?: string;
}
export class ImportDepartmentsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ImportDepartmentRowDto) rows: ImportDepartmentRowDto[];
}

export class ImportDesignationRowDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(20) grade?: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
}
export class ImportDesignationsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ImportDesignationRowDto) rows: ImportDesignationRowDto[];
}
