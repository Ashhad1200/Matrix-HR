import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const INVITE_ROLES = ['EMPLOYEE', 'MANAGER', 'HR_MANAGER', 'COMPANY_ADMIN'] as const;

export class CreateInviteDto {
  @IsString() @MaxLength(60) employeeId!: string;
  @IsIn(INVITE_ROLES as unknown as string[]) role!: (typeof INVITE_ROLES)[number];
}

export class AcceptInviteDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MinLength(8) @MaxLength(72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Password must contain uppercase, lowercase, and number' }) password!: string;
}
