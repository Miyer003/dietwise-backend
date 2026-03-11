import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement, BADGE_DEFINITIONS } from './entities/user-achievement.entity';

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly achievementRepo: Repository<UserAchievement>,
  ) {}

  // 获取所有成就
  async getAll(userId: string) {
    const achievements = await this.achievementRepo.find({
      where: { userId },
      order: { unlockedAt: 'DESC' },
    });

    return {
      total: achievements.length,
      achievements: achievements.map(a => ({
        badgeCode: a.badgeCode,
        badgeName: a.badgeName,
        badgeDesc: a.badgeDesc,
        iconEmoji: a.iconEmoji,
        iconColor: a.iconColor,
        unlockedAt: a.unlockedAt,
        isNew: a.isNew,
      })),
    };
  }

  // 获取新解锁成就
  async getNew(userId: string) {
    const achievements = await this.achievementRepo.find({
      where: { userId, isNew: true },
      order: { unlockedAt: 'DESC' },
    });

    return {
      count: achievements.length,
      achievements: achievements.map(a => ({
        badgeCode: a.badgeCode,
        badgeName: a.badgeName,
        badgeDesc: a.badgeDesc,
        iconEmoji: a.iconEmoji,
        iconColor: a.iconColor,
        unlockedAt: a.unlockedAt,
      })),
    };
  }

  // 标记为已读
  async markAsRead(userId: string) {
    await this.achievementRepo.update(
      { userId, isNew: true },
      { isNew: false },
    );
  }

  // 解锁成就
  async unlock(userId: string, badgeCode: keyof typeof BADGE_DEFINITIONS) {
    const existing = await this.achievementRepo.findOne({
      where: { userId, badgeCode },
    });

    if (existing) {
      return existing; // 已解锁过
    }

    const badgeDef = BADGE_DEFINITIONS[badgeCode];
    if (!badgeDef) {
      throw new Error(`未知的徽章代码: ${badgeCode}`);
    }

    const achievement = this.achievementRepo.create({
      userId,
      badgeCode,
      badgeName: badgeDef.name,
      badgeDesc: badgeDef.desc,
      iconEmoji: badgeDef.icon,
      iconColor: badgeDef.color,
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
