import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsNumber() @Min(0) maxAmountPerItem?: number;
  @IsOptional() @IsBoolean() requiresReceipt?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsNumber() @Min(0) maxAmountPerItem?: number | null;
  @IsOptional() @IsBoolean() requiresReceipt?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ExpenseItemDto {
  @IsString() categoryId: string;
  @IsDateString() date: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(10_000_000) amount: number;
  @IsString() @MaxLength(300) description: string;
  @IsOptional() @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] }) receiptUrl?: string;
}

export class CreateClaimDto {
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ValidateNested({ each: true }) @Type(() => ExpenseItemDto) @ArrayMinSize(1) @ArrayMaxSize(50)
  items: ExpenseItemDto[];
}

export class UpdateClaimDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @ValidateNested({ each: true }) @Type(() => ExpenseItemDto) @ArrayMinSize(1) @ArrayMaxSize(50)
  items?: ExpenseItemDto[];
}

export class ClaimDecisionDto {
  @IsIn(['APPROVE', 'REJECT']) action: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
