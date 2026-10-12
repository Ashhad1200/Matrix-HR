import { IsDateString, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

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
