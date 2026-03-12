import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UpdateUserDto, UpdateUserProfileDto } from './dto/user.dto';
import { DietRecord } from '../diet/entities/diet-record.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(DietRecord)
    private readonly dietRecordRepo: Repository<DietRecord>,
  ) {}

  // 创建用户
  async create(data: { phone: string; passwordHash: string; nickname?: string }): Promise<User> {
    const user = this.userRepo.create({
      phone: data.phone,
      passwordHash: data.passwordHash,
      nickname: data.nickname || '膳智用户',
      status: UserStatus.ACTIVE,
    });

    const saved = await this.userRepo.save(user);
    
    // 创建默认用户画像
    const profile = this.profileRepo.create({
      userId: saved.id,
      mealCount: 3,
    });
    await this.profileRepo.save(profile);

    return saved;
  }

  // 根据ID查找用户
  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ['profile'],
    });
  }

  // 根据手机号查找用户
  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { phone },
      relations: ['profile'],
    });
  }

  // 更新最后登录时间
  async updateLastLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }

  // 获取当前用户信息
  async getMe(userId: string) {
    const user = await this.findById(userId);
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
    };
  }

  // 更新用户信息
  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (dto.nickname !== undefined) {
      user.nickname = dto.nickname;
    }
    if (dto.avatarEmoji !== undefined) {
      user.avatarEmoji = dto.avatarEmoji;
    }

    return this.userRepo.save(user);
  }

  // 获取用户画像
  async getProfile(userId: string) {
    const profile = await this.profileRepo.findOne({
      where: { userId },
    });
    
    if (!profile) {
      throw new NotFoundException('用户画像不存在');
    }

    return profile;
  }

  // 更新用户画像
  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    let profile = await this.profileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.profileRepo.create({ userId });
    }

    // 更新字段
    Object.assign(profile, dto);

    // 重新计算BMR（如果提供了身高体重年龄性别）
    if (dto.heightCm || dto.weightKg || dto.gender || dto.birthDate) {
      profile.bmr = this.calculateBMR(profile);
    }

    // 如果设置了每日热量目标，使用用户设置；否则基于BMR自动计算
    if (!profile.dailyCalorieGoal && profile.bmr) {
      profile.dailyCalorieGoal = this.calculateDailyCalorieGoal(profile);
    }

    profile.updatedAt = new Date();
    return this.profileRepo.save(profile);
  }

  // 删除用户（软删除）
  async delete(userId: string): Promise<void> {
    const result = await this.userRepo.softDelete(userId);
    if (result.affected === 0) {
      throw new NotFoundException('用户不存在');
    }
  }

  // 计算BMR（基础代谢率）- Mifflin-St Jeor公式
  private calculateBMR(profile: UserProfile): number {
    if (!profile.weightKg || !profile.heightCm || !profile.gender) {
      return undefined as any;
    }

    const age = this.calculateAge(profile.birthDate);
    if (!age) return undefined as any;

    let bmr: number;
    if (profile.gender === 'male') {
      bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age + 5;
    } else {
      bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age - 161;
    }

    return Math.round(bmr * 100) / 100;
  }

  // 计算每日热量目标
  private calculateDailyCalorieGoal(profile: UserProfile): number {
    if (!profile.bmr) return 2000;

    // 活动系数
    const activityMultipliers = {
      sedentary: 1.2,      // 久坐
      lightly: 1.375,      // 轻度活动
      moderately: 1.55,    // 中度活动
      very: 1.725,         // 高度活动
    };

    const multiplier = (activityMultipliers as any)[profile.activityLevel || 'lightly'] || 1.375;
    let target = Math.round(profile.bmr * multiplier);

    // 根据健康目标调整
    if (profile.healthGoal === '减脂') {
      target -= 500;
    } else if (profile.healthGoal === '增肌') {
      target += 300;
    }

    return target;
  }

  // 计算年龄
  private calculateAge(birthDate: Date): number {
    if (!birthDate) return undefined as any;
    const today = new Date();
    let age = today.getFullYear() - new Date(birthDate).getFullYear();
    const monthDiff = today.getMonth() - new Date(birthDate).getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < new Date(birthDate).getDate())) {
      age--;
    }
    return age;
  }

  // 获取用户统计
  async getStats(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 获取总记录数
    const totalRecords = await this.dietRecordRepo.count({
      where: { userId },
    });

    // 计算连续打卡天数
    const streakDays = await this.calculateStreakDays(userId);

    // 计算加入天数
    const joinDays = Math.floor(
      (new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalRecords,
      streakDays,
      joinDays,
      joinDate: user.createdAt,
    };
  }

  // 计算连续打卡天数
  private async calculateStreakDays(userId: string): Promise<number> {
    const records = await this.dietRecordRepo.find({
      where: { userId },
      order: { recordDate: 'DESC' },
      select: ['recordDate'],
    });

    if (records.length === 0) {
      return 0;
    }

    // 获取唯一日期列表
    const uniqueDates = [...new Set(records.map(r => 
      new Date(r.recordDate).toISOString().split('T')[0]
    ))].sort().reverse();

    if (uniqueDates.length === 0) {
      return 0;
    }

    // 检查今天或昨天是否有记录
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      return 0; // 最近没有记录
    }

    // 计算连续天数
    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i - 1]);
      const prevDate = new Date(uniqueDates[i]);
      const diffDays = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
