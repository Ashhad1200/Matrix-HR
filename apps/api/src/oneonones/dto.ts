import { IsString, IsOptional, IsDateString, IsArray, IsIn } from 'class-validator';

export class CreateOneOnOneDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsArray()
  talkingPoints?: { text: string; done: boolean }[];
}

export class UpdateOneOnOneDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsIn(['scheduled', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsArray()
  talkingPoints?: { text: string; done: boolean }[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  privateNotes?: string;
}
