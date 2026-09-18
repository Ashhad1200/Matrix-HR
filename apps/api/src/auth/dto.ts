import { IsEmail, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const STRONG_MESSAGE = 'Password must contain uppercase, lowercase, and number';

export class SignUpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt silently ignores anything past 72 bytes
  @Matches(STRONG_PASSWORD, { message: STRONG_MESSAGE })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/)
  subdomain: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD, { message: STRONG_MESSAGE })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD, { message: STRONG_MESSAGE })
  newPassword: string;
}

export class MfaVerifyDto {
  @IsString()
  mfaToken: string;

  /** 6-digit authenticator code, or a recovery code like ABCDE-FGHIJ. */
  @IsString()
  @MaxLength(32)
  code: string;
}

export class MfaEnableDto {
  @IsString()
  @MaxLength(10)
  code: string;
}

export class MfaDisableDto {
  @IsString()
  @MaxLength(200)
  password: string;

  @IsString()
  @MaxLength(32)
  code: string;
}

export class LogoutDto {
  @IsString()
  refreshToken: string;
}
