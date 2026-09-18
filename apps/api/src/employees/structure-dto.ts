import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() parentId?: string;
}

export class CreateDesignationDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(20) grade?: string;
  @IsOptional() @IsString() departmentId?: string;
}

export class AddDocumentDto {
  @IsString() @MaxLength(60) type: string;
  @IsString() @MaxLength(200) name: string;
  // Must be an http(s) URL — a stored "javascript:" link would run when someone clicks it.
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }) fileUrl: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}
