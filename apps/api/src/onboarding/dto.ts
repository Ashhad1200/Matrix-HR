import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class StartOnboardingDto {
  @IsString() employeeId: string;
  @IsString() templateId: string;
}

export class TemplateTaskDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsIn(['pre_joining', 'day1', 'week1', 'month1', 'month3']) phase?: string;
  @IsOptional() @IsIn(['employee', 'hr', 'manager', 'it']) assignee?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
}

export class CreateTemplateDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) role?: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => TemplateTaskDto) tasks: TemplateTaskDto[];
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Replaces the task list. Refused once someone has started this template, so their progress never points at a deleted task. */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => TemplateTaskDto) tasks?: TemplateTaskDto[];
}
