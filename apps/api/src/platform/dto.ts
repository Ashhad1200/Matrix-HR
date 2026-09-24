import { IsString, IsOptional, IsBoolean, IsInt, IsIn, IsDateString, IsEmail, IsNumber, MinLength, MaxLength, Matches, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired'];
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/)
  subdomain!: string;

  @IsEmail()
  adminEmail!: string;

  // Left unset: a strong random password is generated and returned once — the operator hands it to
  // the client (or the client resets it via forgot-password).
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD, { message: 'Password must contain uppercase, lowercase, and number' })
  adminPassword?: string;

  @IsOptional()
  @IsString()
  planCode?: string;
}

class PlanEntitlementInput {
  @IsString()
  featureKey!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  limit?: number;
}

export class CreatePlanDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsNumber()
  pricePkrMonthly?: number;

  @IsOptional()
  @IsInt()
  includedEmployees?: number;

  @IsOptional()
  @IsNumber()
  perEmployeePricePkr?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanEntitlementInput)
  entitlements?: PlanEntitlementInput[];
}

export class AssignPlanDto {
  @IsString()
  planCode!: string;
}

export class SetSubscriptionStatusDto {
  @IsIn(SUBSCRIPTION_STATUSES)
  status!: string;
}

export class CreateOverrideDto {
  @IsString()
  featureKey!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
