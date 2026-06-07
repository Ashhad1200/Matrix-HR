import { IsOptional, IsNumber } from 'class-validator';

export class ClockInDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
