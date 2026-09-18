import { Controller, Post, Get, Body, UseGuards, Ip } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  SignUpDto, LoginDto, RefreshDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto,
  MfaVerifyDto, MfaEnableDto, MfaDisableDto, LogoutDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';

// Credential endpoints get their own, much tighter per-IP limit than the global 100/min
// (AUTH_THROTTLE_LIMIT exists so local test suites can log in repeatedly).
const strict = (perMinute: number) => ({
  default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT) || perMinute, ttl: 60_000 },
});

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle(strict(5))
  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Throttle(strict(10))
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Throttle(strict(10))
  @Post('mfa/verify')
  mfaVerify(@Body() dto: MfaVerifyDto, @Ip() ip: string) {
    return this.auth.mfaVerify(dto.mfaToken, dto.code, ip);
  }

  @Throttle(strict(30))
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Throttle(strict(5))
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Throttle(strict(10))
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(strict(10))
  @Post('change-password')
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto, @Ip() ip: string) {
    return this.auth.changePassword(userId, dto.currentPassword, dto.newPassword, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  mfaSetup(@CurrentUser('id') userId: string) {
    return this.auth.mfaSetup(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(strict(10))
  @Post('mfa/enable')
  mfaEnable(@CurrentUser('id') userId: string, @Body() dto: MfaEnableDto) {
    return this.auth.mfaEnable(userId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(strict(10))
  @Post('mfa/disable')
  mfaDisable(@CurrentUser('id') userId: string, @Body() dto: MfaDisableDto) {
    return this.auth.mfaDisable(userId, dto.password, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.auth.getMe(userId);
  }
}
