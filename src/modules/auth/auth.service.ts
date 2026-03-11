import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '../../shared/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(phone: string, password: string, nickname?: string, smsCode?: string) {
    // 验证短信验证码（简化实现，实际需接入 SMS 服务）
    const cachedCode = await this.redisService.get(`sms:code:${phone}`);
    if (process.env.NODE_ENV === 'production' && cachedCode !== smsCode) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    const existingUser = await this.userService.findByPhone(phone);
    if (existingUser) {
      throw new ConflictException('手机号已注册');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.userService.create({
      phone,
      passwordHash,
      nickname: nickname || '膳智用户',
    });

    return this.generateTokens(user);
  }

  async login(phone: string, password: string) {
    const user = await this.userService.findByPhone(phone);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    await this.userService.updateLastLogin(user.id);
    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET,
      });
      const user = await this.userService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('用户不存在');
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh Token 无效');
    }
  }

  async logout(userId: string, jti: string) {
    // 将 token 加入黑名单（使用 Redis TTL 与 token 剩余有效期一致）
    await this.redisService.set(`jwt:blacklist:${jti}`, '1', 7 * 24 * 3600);
  }

  // 发送短信验证码
  async sendSmsCode(phone: string) {
    // 检查发送频率限制
    const limitKey = `sms:limit:${phone}`;
    const isLimited = await this.redisService.get(limitKey);
    if (isLimited) {
      throw new BadRequestException('发送太频繁，请稍后再试');
    }

    // 生成验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 存入Redis，5分钟有效
    await this.redisService.set(`sms:code:${phone}`, code, 300);
    
    // 设置发送频率限制，1分钟内不能重复发送
    await this.redisService.set(limitKey, '1', 60);

    // TODO: 调用实际的短信服务发送验证码
    console.log(`[SMS] 发送验证码 ${code} 到 ${phone}`);

    return { message: '验证码已发送', expireIn: 300 };
  }

  // 验证码登录
  async verifySmsAndLogin(phone: string, smsCode: string) {
    const cachedCode = await this.redisService.get(`sms:code:${phone}`);
    
    // 开发环境允许任意验证码
    if (process.env.NODE_ENV === 'production' && cachedCode !== smsCode) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    let user = await this.userService.findByPhone(phone);
    
    // 如果用户不存在，自动注册
    if (!user) {
      const passwordHash = await bcrypt.hash(Math.random().toString(36), 12);
      user = await this.userService.create({
        phone,
        passwordHash,
        nickname: `用户${phone.slice(-4)}`,
      });
    }

    await this.userService.updateLastLogin(user.id);
    
    // 清除验证码
    await this.redisService.del(`sms:code:${phone}`);
    
    return this.generateTokens(user);
  }

  private generateTokens(user: any) {
    const jti = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const payload = { sub: user.id, phone: user.phone, role: user.role, jti };
    
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: '30d',
      }),
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarEmoji: user.avatarEmoji,
        role: user.role,
      },
    };
  }
}
