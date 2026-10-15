import {
  IsArray, IsBoolean, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/** HR/admin: turn monitoring on/off and set the policy, work window and retention. */
export class UpdateMonitoringSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(20000) policyText?: string;
  @IsOptional() @IsBoolean() trackApps?: boolean;
  @IsOptional() @IsBoolean() trackDomains?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1439) workdayStartMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1440) workdayEndMin?: number;
  @IsOptional() @IsInt() @Min(5) @Max(240) offlineAlertMins?: number;
  @IsOptional() @IsInt() @Min(1) @Max(400) retentionRawDays?: number;
  @IsOptional() @IsInt() @Min(7) @Max(3650) retentionSummaryDays?: number;
}

/** Employee pairs a new agent install (after accepting the policy). */
export class PairDeviceDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(20) platform?: string;
  @IsOptional() @IsString() @MaxLength(40) agentVersion?: string;
}

/** One recorded window of activity — counts and durations only, never any content. */
export class ActivitySampleDto {
  @IsISO8601() windowStart!: string;
  @IsISO8601() windowEnd!: string;
  @IsInt() @Min(0) @Max(86400) activeSeconds!: number;
  @IsInt() @Min(0) @Max(86400) idleSeconds!: number;
  @IsInt() @Min(0) @Max(10_000_000) mouseEvents!: number;
  @IsInt() @Min(0) @Max(10_000_000) keyboardEvents!: number;
  @IsOptional() @IsString() @MaxLength(160) foregroundApp?: string;
  @IsOptional() @IsString() @MaxLength(253) foregroundDomain?: string;
}

/** A batch from the agent. An empty `samples` array is a plain heartbeat. */
export class IngestDto {
  @IsOptional() @IsString() @MaxLength(40) agentVersion?: string;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ActivitySampleDto)
  samples!: ActivitySampleDto[];
}
