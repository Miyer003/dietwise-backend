import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { RegisterDto, LoginDto, RefreshTokenDto, SendSmsCodeDto, VerifySmsDto } from './dto/auth.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.phone, dto.password, dto.nickname, dto.smsCode);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '账号密码登录' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Public()
  @Post('send-sms-code')
  @ApiOperation({ summary: '发送短信验证码' })
  async sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.authService.sendSmsCode(dto.phone);
  }

  @Public()
  @Post('verify-sms')
  @ApiOperation({ summary: '验证码登录' })
  async verifySms(@Body() dto: VerifySmsDto) {
    return this.authService.verifySmsAndLogin(dto.phone, dto.smsCode);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新Token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出' })
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.userId, req.user.jti);
    return { message: '登出成功' };
  }
}
