import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestDto {
  @IsIn(['plan', 'credit_pack']) purpose!: 'plan' | 'credit_pack';
  @IsOptional() @IsString() @MaxLength(40) planCode?: string;
  @IsOptional() @IsIn(['monthly', 'yearly']) period?: 'monthly' | 'yearly';
  @IsOptional() @IsString() @MaxLength(40) packCode?: string;
  @IsString() @MaxLength(60) accountId!: string;
}

/** Multipart text fields arrive as strings, hence @Type. The expected amount is never accepted from the client. */
export class UploadProofDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) declaredAmount?: number;
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/) declaredCurrency?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ApproveDto {
  /** Only needed when it differs from the expected price; a reason is then mandatory. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) approvedAmount?: number;
  /** Override the new period end (plan requests). A reason is mandatory. */
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class RejectDto {
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class AccountDto {
  @IsString() @Length(2, 80) label!: string;
  @IsString() @Length(2, 120) bankName!: string;
  @IsString() @Length(2, 120) accountTitle!: string;
  @IsOptional() @IsString() @MaxLength(60) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(60) iban?: string;
  @IsOptional() @IsString() @MaxLength(30) swift?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/) currency?: string;
  @IsOptional() @IsString() @MaxLength(500) instructions?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(30) graceDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(168) provisionalHours?: number;
  @IsOptional() @IsString() @Matches(/^\d{1,2}(,\s*\d{1,2}){0,4}$/, { message: 'reminderDays is a comma-separated list like "7,1,0"' }) reminderDays?: string;
}

export class PlanEditDto {
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/) currency?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) priceMonthly?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) priceYearly?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) aiCreditsMonthly?: number;
  @IsOptional() @IsInt() @Min(1) maxEmployees?: number;
  @IsOptional() @IsInt() @Min(1) maxAdminUsers?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) overagePerEmployee?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() offeredToNew?: boolean;
}

export class PackEditDto {
  @IsOptional() @IsString() @Length(2, 60) name?: string;
  @IsOptional() @IsInt() @Min(1) credits?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) price?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PeriodDto {
  /** null clears the billing clock: the tenant returns to "never lapses". */
  @IsOptional() @IsDateString() periodEnd?: string | null;
  @IsOptional() @IsIn(['monthly', 'yearly']) billingPeriod?: 'monthly' | 'yearly';
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}

export class GrantCreditsDto {
  @IsInt() @Min(1) @Max(1_000_000) credits!: number;
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
  /** Client-generated; submitting the same key twice grants once. */
  @IsString() @Length(8, 80) idempotencyKey!: string;
}
