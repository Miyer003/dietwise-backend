import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User, UserStatus } from '../user/entities/user.entity';
import { UpdateUserStatusDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // 获取用户列表
  async getUsers(keyword?: string, page: number = 1, limit: number = 20) {
    const where: any = {};
    
    if (keyword) {
      where.nickname = Like(`%${keyword}%`);
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: users.map(user => ({
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatarEmoji: user.avatarEmoji,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      })),
    };
  }

  // 获取用户详情
  async getUserDetail(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatarEmoji: user.avatarEmoji,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
    };
  }

  // 更新用户状态
  async updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.status = dto.status;
    return this.userRepo.save(user);
  }

  // AI统计（简化实现）
  async getAIStats(startDate?: string, endDate?: string) {
    // TODO: 从ai_call_logs表查询统计数据
    return {
      totalCalls: 0,
      totalCost: 0,
      dateRange: { startDate, endDate },
    };
  }

  // 按服务商统计
  async getAIStatsByProviders() {
    // TODO: 从ai_call_logs表按服务商分组统计
    return [
      { provider: 'qwen-vl', calls: 0, cost: 0 },
      { provider: 'qwen-turbo', calls: 0, cost: 0 },
      { provider: 'kimi-v1', calls: 0, cost: 0 },
    ];
  }
}
