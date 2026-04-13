import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement } from './entities/user-achievement.entity';
import { BadgeDefinition } from '../badge/entities/badge-definition.entity';

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly achievementRepo: Repository<UserAchievement>,
    @InjectRepository(BadgeDefinition)
    private readonly badgeRepo: Repository<BadgeDefinition>,
  ) {}

  // 获取所有成就
  async getAll(userId: string) {
    const achievements = await this.achievementRepo.find({
      where: { userId },
      order: { unlockedAt: 'DESC' },
    });

    // 获取所有徽章定义用于补充旧数据
    const badgeDefs = await this.badgeRepo.find({ where: { isActive: true } });
    const badgeDefMap = new Map(badgeDefs.map(b => [b.badgeCode, b]));

    return {
      total: achievements.length,
      achievements: achievements.map(a => {
        // 旧数据可能没有 category/conditionType，从 BadgeDefinition 补充
        const badgeDef = badgeDefMap.get(a.badgeCode);
        return {
          badgeCode: a.badgeCode,
          badgeName: a.badgeName,
          badgeDesc: a.badgeDesc,
          iconEmoji: a.iconEmoji,
          iconColor: a.iconColor,
          // 优先使用记录中的值，如果为默认值则从 BadgeDefinition 获取
          category: (a.category && a.category !== 'habit') ? a.category : (badgeDef?.category || 'habit'),
          conditionType: (a.conditionType && a.conditionType !== 'default') ? a.conditionType : (badgeDef?.conditionType || 'default'),
          conditionValue: a.conditionValue || badgeDef?.conditionValue || 1,
          unlockedAt: a.unlockedAt,
          isNew: a.isNew,
        };
      }),
      badgeDefinitions: badgeDefs.map(b => ({
        badgeCode: b.badgeCode,
        badgeName: b.badgeName,
        badgeDesc: b.badgeDesc,
        iconEmoji: b.iconEmoji,
        iconColor: b.iconColor,
        category: b.category,
        conditionType: b.conditionType,
        conditionValue: b.conditionValue,
      })),
    };
  }

  // 获取新解锁成就
  async getNew(userId: string) {
    const achievements = await this.achievementRepo.find({
      where: { userId, isNew: true },
      order: { unlockedAt: 'DESC' },
    });

    // 获取所有徽章定义用于补充旧数据
    const badgeDefs = await this.badgeRepo.find();
    const badgeDefMap = new Map(badgeDefs.map(b => [b.badgeCode, b]));

    return {
      count: achievements.length,
      achievements: achievements.map(a => {
        const badgeDef = badgeDefMap.get(a.badgeCode);
        return {
          badgeCode: a.badgeCode,
          badgeName: a.badgeName,
          badgeDesc: a.badgeDesc,
          iconEmoji: a.iconEmoji,
          iconColor: a.iconColor,
          category: (a.category && a.category !== 'habit') ? a.category : (badgeDef?.category || 'habit'),
          conditionType: (a.conditionType && a.conditionType !== 'default') ? a.conditionType : (badgeDef?.conditionType || 'default'),
          conditionValue: a.conditionValue || badgeDef?.conditionValue || 1,
          unlockedAt: a.unlockedAt,
        };
      }),
    };
  }

  // 标记为已读
  async markAsRead(userId: string) {
    await this.achievementRepo.update(
      { userId, isNew: true },
      { isNew: false },
    );
  }

  // 解锁成就 - 从数据库获取完整徽章定义
  async unlock(userId: string, badgeCode: string) {
    const existing = await this.achievementRepo.findOne({
      where: { userId, badgeCode },
    });

    if (existing) {
      return existing; // 已解锁过
    }

    // 从数据库获取徽章定义
    const badgeDef = await this.badgeRepo.findOne({
      where: { badgeCode, isActive: true },
    });
    
    if (!badgeDef) {
      throw new Error(`未知的徽章代码: ${badgeCode}`);
    }

    const achievement = this.achievementRepo.create({
      userId,
      badgeCode: badgeDef.badgeCode,
      badgeName: badgeDef.badgeName,
      badgeDesc: badgeDef.badgeDesc,
      iconEmoji: badgeDef.iconEmoji,
      iconColor: badgeDef.iconColor,
      category: badgeDef.category,
      conditionType: badgeDef.conditionType,
      conditionValue: badgeDef.conditionValue,
      unlockedAt: new Date(),
      isNew: true,
    });

    return this.achievementRepo.save(achievement);
  }

  // 检查用户是否已获得某徽章
  async hasAchievement(userId: string, badgeCode: string): Promise<boolean> {
    const count = await this.achievementRepo.count({
      where: { userId, badgeCode },
    });
    return count > 0;
  }
}
