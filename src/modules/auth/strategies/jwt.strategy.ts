import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../shared/redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('app.jwt.secret')!,
    } as any);
  }

  async validate(payload: any) {
    // 检查 Token 是否在黑名单
    const isBlacklisted = await this.redisService.get(`jwt:blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token 已失效');
    }
    
    return { userId: payload.sub, phone: payload.phone, role: payload.role };
  }
}