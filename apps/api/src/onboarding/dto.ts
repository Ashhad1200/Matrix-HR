import { IsString } from 'class-validator';

export class StartOnboardingDto {
  @IsString() employeeId: string;
  @IsString() templateId: string;
}
