import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // 根据设计文档中的缓存键规则
  async cacheAIAnalysis(imageHash: string, result: any, ttl: number = 3600): Promise<void> {
    const key = `ai:nutrition:${imageHash}`;
    await this.set(key, JSON.stringify(result), ttl);
  }

  async getCachedAIAnalysis(imageHash: string): Promise<any | null> {
    const key = `ai:nutrition:${imageHash}`;
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async rateLimit(userId: string, type: 'api' | 'ai', limit: number, windowSeconds: number = 60): Promise<boolean> {
    const key = `rate:${type}:${userId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return current <= limit;
  }
}