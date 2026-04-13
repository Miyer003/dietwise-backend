import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserAchievement } from './entities/user-achievement.entity';
import { BadgeDefinition } from '../badge/entities/badge-definition.entity';
import { DietRecord, InputMethod } from '../diet/entities/diet-record.entity';
import { DietRecordItem } from '../diet/entities/diet-record-item.entity';
import { AICallLog, AIFunctionType } from '../ai/entities/ai-call-log.entity';

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly achievementRepo: Repository<UserAchievement>,
    @InjectRepository(BadgeDefinition)
    private readonly badgeRepo: Repository<BadgeDefinition>,
    @InjectRepository(DietRecord)
    private readonly recordRepo: Repository<DietRecord>,
    @InjectRepository(DietRecordItem)
    private readonly itemRepo: Repository<DietRecordItem>,
    @InjectRepository(AICallLog)
    private readonly aiLogRepo: Repository<AICallLog>,
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

  // 获取成就进度
  async getProgress(userId: string) {
    const badgeDefs = await this.badgeRepo.find({ where: { isActive: true } });
    const progress: Record<string, { current: number; target: number }> = {};

    // 预计算常用统计
    const totalRecords = await this.recordRepo.count({ where: { userId } });
    const photoRecords = await this.recordRepo.count({ where: { userId, inputMethod: 'photo' as InputMethod } });
    const chatCount = await this.aiLogRepo.count({ where: { userId, functionType: AIFunctionType.CHAT, success: true } });
    const consecutiveDays = await this.getConsecutiveRecordDays(userId);
    const earlyBirdDays = await this.getConsecutiveEarlyBreakfastDays(userId);
    const veggieCount = await this.getTotalVeggieItems(userId);
    const waterCount = await this.getTotalWaterRecords(userId);
    const { balancedDays, sugarControlDays, caloriePerfectDays, proteinDays } = await this.getBalanceStats(userId);

    for (const badge of badgeDefs) {
      let current = 0;
      switch (badge.conditionType) {
        case 'streak_days':
          current = consecutiveDays;
          break;
        case 'record_count':
          current = totalRecords;
          break;
        case 'photo_count':
          current = photoRecords;
          break;
        case 'chat_count':
          current = chatCount;
          break;
        case 'early_record':
          current = earlyBirdDays;
          break;
        case 'veggie_count':
          current = veggieCount;
          break;
        case 'water_days':
          current = waterCount;
          break;
        case 'balanced_days':
          current = balancedDays;
          break;
        case 'sugar_control_days':
          current = sugarControlDays;
          break;
        case 'calorie_perfect_days':
          current = caloriePerfectDays;
          break;
        case 'protein_days':
          current = proteinDays;
          break;
        default:
          current = 0;
      }
      progress[badge.badgeCode] = {
        current,
        target: badge.conditionValue,
      };
    }

    return progress;
  }

  private async getConsecutiveRecordDays(userId: string): Promise<number> {
    const records = await this.recordRepo
      .createQueryBuilder('record')
      .select('DISTINCT DATE(record.recordDate)', 'date')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .orderBy('date', 'DESC')
      .getRawMany();

    const dates = records.map(r => new Date(r.date).toISOString().split('T')[0]);
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let consecutive = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i] + 'T00:00:00Z');
      const next = new Date(dates[i + 1] + 'T00:00:00Z');
      const diffDays = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  private async getConsecutiveEarlyBreakfastDays(userId: string): Promise<number> {
    const records = await this.recordRepo.find({
      where: { userId, mealType: 'breakfast' as any },
      order: { createdAt: 'DESC' },
    });

    const dateSet = new Set<string>();
    for (const record of records) {
      const hour = new Date(record.createdAt).getHours();
      if (hour < 8) {
        dateSet.add(new Date(record.createdAt).toISOString().split('T')[0]);
      }
    }

    const dates = Array.from(dateSet).sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let consecutive = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i] + 'T00:00:00Z');
      const next = new Date(dates[i + 1] + 'T00:00:00Z');
      const diffDays = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  private async getTotalVeggieItems(userId: string): Promise<number> {
    const veggieKeywords = ['蔬菜', '青菜', '白菜', '菠菜', '芹菜', '黄瓜', '番茄', '西红柿', '西兰花', '胡萝卜', '生菜', '韭菜', '茄子', '南瓜', '冬瓜', '土豆', '马铃薯', '洋葱', '青椒', '辣椒', '蒜苔', '莴笋', '芦笋', '豆芽', '蘑菇', '木耳', '海带', '菜心', '油麦菜', '茼蒿', '芥蓝', '甘蓝', '卷心菜', '花菜', '菜花', '荷兰豆', '四季豆', '豌豆', '豇豆', '藕', '山药', '红薯', '紫薯', '芋头', '玉米', '秋葵', '丝瓜', '苦瓜', '西葫芦', '瓠子', '佛手瓜', '空心菜', '苋菜', '蕨菜', '香椿', '蒜苗', '小葱', '香菜', '茴香', '荠菜', '马齿苋', '蒲公英', '木耳菜', '茭白', '竹笋', '萝卜', '白萝卜', '青萝卜', '樱桃萝卜', '水萝卜', '榨菜', '雪里蕻', '梅干菜'];

    const items = await this.itemRepo
      .createQueryBuilder('item')
      .leftJoin('item.record', 'record')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .getMany();

    return items.filter(item =>
      veggieKeywords.some(keyword => item.foodName.includes(keyword))
    ).length;
  }

  private async getTotalWaterRecords(userId: string): Promise<number> {
    const waterKeywords = ['水', '牛奶', '豆浆', '汤', '咖啡', '茶', '果汁', '奶茶', '可乐', '汽水', '酸奶', '椰汁', '杏仁露', '酸梅汤', '绿豆汤', '银耳汤', '梨汤', '蜂蜜水', '柠檬水'];

    const records = await this.recordRepo
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.items', 'items')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .getMany();

    let count = 0;
    for (const record of records) {
      const hasWaterItem = record.items.some(item =>
        waterKeywords.some(keyword => item.foodName.includes(keyword))
      );
      const hasWaterNote = record.notes && /喝.?水|饮水|喝水/i.test(record.notes);
      if (hasWaterItem || hasWaterNote) {
        count++;
      }
    }
    return count;
  }

  private async getBalanceStats(userId: string) {
    // 查询最近90天的所有记录，按日期分组
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const records = await this.recordRepo.find({
      where: {
        userId,
        recordDate: Between(startDate, new Date()),
      },
      relations: ['items'],
      order: { recordDate: 'DESC' },
    });

    // 按日期汇总（这里简化处理，直接用记录的总营养值）
    const dailyMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const record of records) {
      const dateStr = new Date(record.recordDate).toISOString().split('T')[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
      const day = dailyMap.get(dateStr)!;
      day.calories += Number(record.totalCalories) || 0;
      day.protein += Number(record.totalProtein) || 0;
      day.carbs += Number(record.totalCarbs) || 0;
      day.fat += Number(record.totalFat) || 0;
    }

    // 使用默认目标值（因为achievement模块没有注入UserService）
    const calorieGoal = 2000;
    const proteinGoal = 60;
    const carbsGoal = 250;
    const fatGoal = 65;

    const calorieMet: boolean[] = [];
    const proteinMet: boolean[] = [];
    const balancedMet: boolean[] = [];
    const sugarControlMet: boolean[] = [];

    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const day = dailyMap.get(dateStr);

      if (!day) break;

      const calorieDeviation = Math.abs(day.calories - calorieGoal) / calorieGoal;
      const isCaloriePerfect = calorieDeviation <= 0.15;
      const isProteinOk = day.protein >= proteinGoal * 0.8;
      const isCarbsOk = day.carbs <= carbsGoal * 1.3 && day.carbs >= carbsGoal * 0.5;
      const isFatOk = day.fat <= fatGoal * 1.3 && day.fat >= fatGoal * 0.5;
      const isBalanced = isCaloriePerfect && isProteinOk && isCarbsOk && isFatOk;
      const isSugarControl = day.carbs <= carbsGoal * 1.1 && calorieDeviation <= 0.2;

      calorieMet.push(isCaloriePerfect);
      proteinMet.push(isProteinOk);
      balancedMet.push(isBalanced);
      sugarControlMet.push(isSugarControl);
    }

    return {
      caloriePerfectDays: this.getConsecutiveTrueFromStart(calorieMet),
      proteinDays: this.getConsecutiveTrueFromStart(proteinMet),
      balancedDays: this.getConsecutiveTrueFromStart(balancedMet),
      sugarControlDays: this.getConsecutiveTrueFromStart(sugarControlMet),
    };
  }

  private getConsecutiveTrueFromStart(arr: boolean[]): number {
    let count = 0;
    for (const val of arr) {
      if (val) count++;
      else break;
    }
    return count;
  }
}
