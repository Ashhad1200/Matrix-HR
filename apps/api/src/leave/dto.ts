import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, IsNumber, IsDateString, Matches, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeaveRequestDto {
  @IsString()
  policyId: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isHalfDay?: boolean;

  @IsOptional()
  @IsEnum(['morning', 'afternoon'])
  halfDayPeriod?: 'morning' | 'afternoon';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateLeavePolicyDto {
  @IsString() @Length(2, 80) name: string;
  /** Short unique key, e.g. "annual". */
  @IsString() @Matches(/^[a-z][a-z0-9_-]{1,30}$/, { message: 'code is lowercase letters, numbers, - or _' }) code: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(365) daysPerYear: number;
  /** Entitlement is granted in full at the start of each year; "monthly" is accepted but not yet pro-rated. */
  @IsOptional() @IsEnum(['yearly', 'monthly']) accrualType?: 'yearly' | 'monthly';
  /** Days that may roll into next year. Empty = nothing carries forward. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(365) carryForwardMax?: number;
  @IsOptional() @IsBoolean() allowHalfDay?: boolean;
  @IsOptional() @IsBoolean() allowNegative?: boolean;
  @IsOptional() @IsString() @Length(1, 20) genderRestriction?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) eligibilityMonths?: number;
}

export class UpdateLeavePolicyDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(365) daysPerYear?: number;
  @IsOptional() @IsEnum(['yearly', 'monthly']) accrualType?: 'yearly' | 'monthly';
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(365) carryForwardMax?: number | null;
  @IsOptional() @IsBoolean() allowHalfDay?: boolean;
  @IsOptional() @IsBoolean() allowNegative?: boolean;
  @IsOptional() @IsString() @Length(1, 20) genderRestriction?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) eligibilityMonths?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateHolidayDto {
  @IsString() @Length(2, 100) name: string;
  @IsDateString() date: string;
  @IsOptional() @IsBoolean() isOptional?: boolean;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
}

export class UpdateHolidayDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsBoolean() isOptional?: boolean;
}
