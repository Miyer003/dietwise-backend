import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual } from 'typeorm';
import { BadgeDefinition, DEFAULT_BADGES } from './entities/badge-definition.entity';
import { CreateBadgeDto, UpdateBadgeDto, BadgeListQueryDto } from './dto/badge.dto';
import { UserAchievement } from '../achievement/entities/user-achievement.entity';

@Injectable()
export class BadgeService {
  constructor(
    @InjectRepository(BadgeDefinition)
    private readonly badgeRepo: Repository<BadgeDefinition>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,
  ) {}

  // 初始化默认徽章
  async initDefaultBadges() {
    for (const badge of DEFAULT_BADGES) {
      const exists = await this.badgeRepo.findOne({
        where: { badgeCode: badge.badgeCode },
      });
      if (!exists) {
        await this.badgeRepo.save(this.badgeRepo.create(badge));
      }
    }
  }

  // 获取徽章列表
  async findAll(query: BadgeListQueryDto) {
    const { category, isActive, page = 1, limit = 20 } = query;
    
    const where: any = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [items, total] = await this.badgeRepo.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items,
    };
  }

  // 获取所有徽章（不分页，用于前端展示）
  async findAllActive() {
    return this.badgeRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  // 获取徽章详情
  async findOne(id: string) {
    const badge = await this.badgeRepo.findOne({ where: { id } });
    if (!badge) {
      throw new NotFoundException('徽章不存在');
    }
    return badge;
  }

  // 创建徽章
  async create(dto: CreateBadgeDto) {
    const exists = await this.badgeRepo.findOne({
      where: { badgeCode: dto.badgeCode },
    });
    if (exists) {
      throw new ConflictException('徽章编码已存在');
    }

    const badge = this.badgeRepo.create(dto);
    return this.badgeRepo.save(badge);
  }

  // 更新徽章
  async update(id: string, dto: UpdateBadgeDto) {
    const badge = await this.findOne(id);
    
    if (dto.badgeCode && dto.badgeCode !== badge.badgeCode) {
      const exists = await this.badgeRepo.findOne({
        where: { badgeCode: dto.badgeCode },
      });
      if (exists) {
        throw new ConflictException('徽章编码已存在');
      }
    }

    Object.assign(badge, dto);
    return this.badgeRepo.save(badge);
  }

  // 删除徽章
  async remove(id: string) {
    const badge = await this.findOne(id);
    
    // 检查是否有人已获得此徽章
    const count = await this.userAchievementRepo.count({
      where: { badgeCode: badge.badgeCode },
    });
    
    if (count > 0) {
      throw new ConflictException(`该徽章已有 ${count} 人获得，无法删除`);
    }

    await this.badgeRepo.remove(badge);
  }

  // 启用/禁用徽章
  async toggleStatus(id: string) {
    const badge = await this.findOne(id);
    badge.isActive = !badge.isActive;
    return this.badgeRepo.save(badge);
  }

  // 获取徽章统计
  async getStats() {
    const badges = await this.badgeRepo.find();
    const stats = [];

    for (const badge of badges) {
      const totalUnlocked = await this.userAchievementRepo.count({
        where: { badgeCode: badge.badgeCode },
      });

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const unlockedThisMonth = await this.userAchievementRepo.count({
        where: {
          badgeCode: badge.badgeCode,
          unlockedAt: MoreThanOrEqual(firstDayOfMonth),
        },
      });

      stats.push({
        badgeCode: badge.badgeCode,
        badgeName: badge.badgeName,
        totalUnlocked,
        unlockedThisMonth,
      });
    }

    return stats;
  }
}
