import { IsString, IsOptional, IsBoolean, IsInt, IsIn, IsDateString } from 'class-validator';

const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired'];

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
