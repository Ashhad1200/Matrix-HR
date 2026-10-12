import { IsOptional, IsNumber, IsString, IsDateString, MaxLength, MinLength } from 'class-validator';

export class ClockInDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class RegularizationDto {
  @IsDateString() date: string;
  @IsString() @MinLength(1) @MaxLength(500) reason: string;
  @IsOptional() @IsDateString() requestedClockIn?: string;
  @IsOptional() @IsDateString() requestedClockOut?: string;
}
