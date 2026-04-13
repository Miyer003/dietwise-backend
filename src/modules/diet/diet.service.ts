import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DietRecord, MealType } from './entities/diet-record.entity';
import { DietRecordItem } from './entities/diet-record-item.entity';
import { CreateDietRecordDto, UpdateDietRecordDto } from './dto/create-diet-record.dto';
import { AIService } from '../../shared/ai/ai.service';
import { RedisService } from '../../shared/redis/redis.service';
import { MinioService } from '../../shared/minio/minio.service';
import { UserService } from '../user/user.service';
import { AchievementService } from '../achievement/achievement.service';

@Injectable()
export class DietService {
  constructor(
    @InjectRepository(DietRecord)
    private readonly recordRepo: Repository<DietRecord>,
    @InjectRepository(DietRecordItem)
    private readonly itemRepo: Repository<DietRecordItem>,
    private readonly aiService: AIService,
    private readonly redisService: RedisService,
    private readonly minioService: MinioService,
    private readonly userService: UserService,
    private readonly achievementService: AchievementService,
  ) {}

  // 获取饮食记录列表
  async getRecords(userId: string, date: string, mealType?: string) {
    const where: any = { userId };
    
    if (date) {
      where.recordDate = date;
    }
    if (mealType) {
      where.mealType = mealType;
    }

    const records = await this.recordRepo.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });

    return records;
  }

  // 获取单条记录详情
  async getRecordById(userId: string, id: string) {
    const record = await this.recordRepo.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!record) {
      throw new NotFoundException('记录不存在');
    }

    if (record.userId !== userId) {
      throw new NotFoundException('无权访问此记录');
    }

    return record;
  }

  // 创建饮食记录（支持 AI 分析）
  async createRecord(userId: string, dto: CreateDietRecordDto) {
    let items: Partial<DietRecordItem>[] = [];

    if (dto.inputMethod === 'photo' && dto.imageUrl) {
      // 计算图片 hash（简化版，实际使用 crypto.createHash）
      const imageHash = dto.imageHash || this.simpleHash(dto.imageUrl);
      
      // 检查缓存
      let analysis = await this.redisService.getCachedAIAnalysis(imageHash);
      
      if (!analysis) {
        // 调用 AI 分析
        const presignedUrl = await this.minioService.getPresignedGetUrl(dto.imageUrl);
        analysis = await this.aiService.analyzeNutrition(presignedUrl);
        
        // 缓存结果
        await this.redisService.cacheAIAnalysis(imageHash, analysis);
      }

      items = [{
        userId,  // 添加 userId
        foodName: analysis.foodName,
        quantityG: analysis.quantityG * (dto.portionFactor || 1),
        portionFactor: dto.portionFactor || 1,
        calories: analysis.calories * (dto.portionFactor || 1),
        proteinG: analysis.proteinG * (dto.portionFactor || 1),
        carbsG: analysis.carbsG * (dto.portionFactor || 1),
        fatG: analysis.fatG * (dto.portionFactor || 1),
        fiberG: analysis.fiberG,
        sodiumMg: analysis.sodiumMg,
        imageUrl: dto.imageUrl,
        imageHash: imageHash,
        aiProvider: 'qwen-vl',
        aiConfidence: analysis.confidence,
      }];
    } else {
      // 手动录入或语音录入
      items = (dto.items || []).map(item => ({
        userId,  // 添加 userId
        foodName: item.foodName,
        foodItemId: item.foodItemId,
        quantityG: item.quantityG,
        portionFactor: item.portionFactor || 1,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG || 0,
        sodiumMg: item.sodiumMg || 0,
      }));
    }

    // 计算总计
    const totals = items.reduce((acc: any, item) => ({
      calories: (acc.calories || 0) + (Number(item.calories) || 0),
      protein: (acc.protein || 0) + (Number(item.proteinG) || 0),
      carbs: (acc.carbs || 0) + (Number(item.carbsG) || 0),
      fat: (acc.fat || 0) + (Number(item.fatG) || 0),
      fiber: (acc.fiber || 0) + (Number(item.fiberG) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    const record = this.recordRepo.create({
      userId,
      recordDate: dto.recordDate ? new Date(dto.recordDate) : new Date(),
      mealType: dto.mealType,
      inputMethod: dto.inputMethod,
      notes: dto.notes,
      totalCalories: totals.calories,
      totalProtein: totals.protein || 0,
      totalCarbs: totals.carbs || 0,
      totalFat: totals.fat || 0,
      items: items as DietRecordItem[],
    });

    const saved = await this.recordRepo.save(record);
    
    // 清除今日摘要缓存
    const today = new Date().toISOString().split('T')[0];
    await this.redisService.del(`diet:daily:${userId}:${today}`);

    // 检查并解锁相关成就（异步执行，不阻塞主流程）
    const recordDate = saved.recordDate instanceof Date ? saved.recordDate : new Date(saved.recordDate);
    this.checkRecordAchievements(userId, dto.inputMethod, recordDate, dto.mealType).catch(() => {});

    return saved;
  }

  // 更新记录
  async updateRecord(userId: string, id: string, dto: UpdateDietRecordDto) {
    const record = await this.getRecordById(userId, id);

    if (dto.notes !== undefined) {
      record.notes = dto.notes;
    }

    if (dto.portionFactor !== undefined && record.items.length > 0) {
      // 重新计算营养成分
      const item = record.items[0];
      const baseCalories = Number(item.calories) / item.portionFactor;
      const baseProtein = Number(item.proteinG) / item.portionFactor;
      const baseCarbs = Number(item.carbsG) / item.portionFactor;
      const baseFat = Number(item.fatG) / item.portionFactor;

      item.portionFactor = dto.portionFactor;
      item.calories = baseCalories * dto.portionFactor;
      item.proteinG = baseProtein * dto.portionFactor;
      item.carbsG = baseCarbs * dto.portionFactor;
      item.fatG = baseFat * dto.portionFactor;
      item.quantityG = item.quantityG * dto.portionFactor;

      // 更新记录总计
      record.totalCalories = Number(item.calories);
      record.totalProtein = Number(item.proteinG);
      record.totalCarbs = Number(item.carbsG);
      record.totalFat = Number(item.fatG);

      await this.itemRepo.save(item);
    }

    const saved = await this.recordRepo.save(record);

    // 清除缓存
    const savedRecordDate = saved.recordDate instanceof Date ? saved.recordDate : new Date(saved.recordDate);
    const date = savedRecordDate.toISOString().split('T')[0];
    await this.redisService.del(`diet:daily:${userId}:${date}`);

    return saved;
  }

  // 删除记录
  async deleteRecord(userId: string, id: string) {
    const record = await this.getRecordById(userId, id);
    // recordDate 可能是 Date 或 string，统一处理
    const recordDate = record.recordDate instanceof Date 
      ? record.recordDate 
      : new Date(record.recordDate);
    const date = recordDate.toISOString().split('T')[0];
    
    // 先删除子表记录（外键约束）
    await this.itemRepo.delete({ recordId: id });
    
    // 再软删除主表记录
    await this.recordRepo.softDelete(id);
    
    // 清除缓存
    await this.redisService.del(`diet:daily:${userId}:${date}`);
  }

  // 获取每日摘要（带缓存）
  async getDailySummary(userId: string, date: string) {
    const cacheKey = `diet:daily:${userId}:${date}`;
    
    // 删除缓存强制刷新数据（避免软删除数据仍出现在缓存中）
    await this.redisService.del(cacheKey);
    
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // 使用 QueryBuilder 确保只查询未软删除的记录
    const records = await this.recordRepo.createQueryBuilder('record')
      .leftJoinAndSelect('record.items', 'items')
      .where('record.userId = :userId', { userId })
      .andWhere('record.recordDate = :date', { date })
      .andWhere('record.deletedAt IS NULL')
      .orderBy('record.createdAt', 'ASC')
      .getMany();

    // 获取用户每日目标
    const profile = await this.userService.getProfile(userId).catch(() => null);
    const goal = profile?.dailyCalorieGoal || 2000;

    const fiberG = records.reduce((sum, r) => 
      sum + r.items.reduce((itemSum, item) => itemSum + Number(item.fiberG || 0), 0), 0);

    const summary = {
      date,
      calorieGoal: goal,
      calorieConsumed: records.reduce((sum, r) => sum + Number(r.totalCalories), 0),
      calorieRemaining: 0,
      proteinG: records.reduce((sum, r) => sum + Number(r.totalProtein), 0),
      carbsG: records.reduce((sum, r) => sum + Number(r.totalCarbs), 0),
      fatG: records.reduce((sum, r) => sum + Number(r.totalFat), 0),
      fiberG,
      healthScore: this.calculateHealthScore(records, goal),
      mealRecords: records.map(r => ({
        id: r.id,
        recordDate: date,
        mealType: r.mealType,
        mealSeq: r.mealSeq,
        totalCalories: r.totalCalories,
        totalProtein: r.totalProtein,
        totalCarbs: r.totalCarbs,
        totalFat: r.totalFat,
        inputMethod: r.inputMethod,
        notes: r.notes,
        items: r.items.map(i => ({
          id: i.id,
          foodName: i.foodName,
          foodItemId: i.foodItemId,
          quantityG: i.quantityG,
          portionFactor: i.portionFactor,
          calories: i.calories,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          fiberG: i.fiberG,
          sodiumMg: i.sodiumMg,
          imageUrl: i.imageUrl,
          imageHash: i.imageHash,
          aiConfidence: i.aiConfidence,
        })),
        createdAt: r.createdAt.toISOString(),
      })),
    };

    summary.calorieRemaining = summary.calorieGoal - summary.calorieConsumed;

    // 缓存 5 分钟
    await this.redisService.set(cacheKey, JSON.stringify(summary), 300);
    
    return summary;
  }

  // 获取周摘要
  async getWeeklySummary(userId: string, weekStart: string) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const records = await this.recordRepo.find({
      where: {
        userId,
        recordDate: Between(start, end) as any,
      },
      order: { recordDate: 'ASC' },
    });

    // 按天分组
    const dailyMap = new Map();
    for (const record of records) {
      // 处理 recordDate 可能是字符串的情况
      const recordDate = record.recordDate instanceof Date ? record.recordDate : new Date(record.recordDate);
      const date = recordDate.toISOString().split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { calories: 0, count: 0 });
      }
      const day = dailyMap.get(date);
      day.calories += Number(record.totalCalories);
      day.count += 1;
    }

    // 生成7天数据
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateStr);
      days.push({
        date: dateStr,
        calories: dayData?.calories || 0,
        hasRecord: !!dayData,
      });
    }

    const avgCalories = days.reduce((sum, d) => sum + d.calories, 0) / 7;
    const compliantDays = days.filter(d => d.calories > 1200 && d.calories < 2500).length;
    
    return {
      weekStart,
      weekEnd: end.toISOString().split('T')[0],
      avgDailyCalories: avgCalories,
      totalDays: 7,
      compliantDays,
      healthScore: Math.min(100, Math.round((compliantDays / 7) * 100)),
      dailyTrends: days.map(d => ({
        date: d.date,
        calories: d.calories,
        isCompliant: d.calories > 1200 && d.calories < 2500,
      })),
    };
  }

  // 获取月摘要
  async getMonthlySummary(userId: string, month: string) {
    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0);

    const records = await this.recordRepo.find({
      where: {
        userId,
        recordDate: Between(start, end) as any,
      },
    });

    const totalCalories = records.reduce((sum, r) => sum + Number(r.totalCalories), 0);
    // 处理 recordDate 可能是字符串的情况
    const daysWithRecords = new Set(records.map(r => {
      const date = r.recordDate instanceof Date ? r.recordDate : new Date(r.recordDate);
      return date.toISOString().split('T')[0];
    })).size;

    const avgDailyCalories = daysWithRecords > 0 ? totalCalories / daysWithRecords : 0;
    const compliantDays = daysWithRecords; // 简化计算

    // 计算每周趋势
    const weeklyTrends = this.calculateWeeklyTrends(records, year, monthNum);
    
    return {
      month,
      avgDailyCalories,
      totalDays: end.getDate(),
      compliantDays,
      healthScore: Math.min(100, Math.round((compliantDays / end.getDate()) * 100)),
      weeklyTrends,
    };
  }

  // 计算每周趋势
  private calculateWeeklyTrends(
    records: DietRecord[],
    year: number,
    month: number,
  ): Array<{ week: number; avgCalories: number }> {
    if (records.length === 0) return [];

    // 按周分组计算平均热量
    const weeklyMap = new Map<number, { total: number; count: number }>();

    for (const record of records) {
      const date = new Date(record.recordDate);
      const dayOfMonth = date.getDate();
      // 计算属于第几周（向上取整）
      const weekNum = Math.ceil(dayOfMonth / 7);
      
      const existing = weeklyMap.get(weekNum) || { total: 0, count: 0 };
      existing.total += Number(record.totalCalories);
      existing.count += 1;
      weeklyMap.set(weekNum, existing);
    }

    // 转换为数组并排序
    return Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        avgCalories: Math.round(data.total / data.count),
      }))
      .sort((a, b) => a.week - b.week);
  }

  private calculateHealthScore(records: DietRecord[], goal: number): number {
    if (records.length === 0) return 0;
    const total = records.reduce((sum, r) => sum + Number(r.totalCalories), 0);
    const deviation = Math.abs(total - goal) / goal;
    if (deviation < 0.1) return 95;
    if (deviation < 0.2) return 85;
    if (deviation < 0.3) return 75;
    return 60;
  }

  private simpleHash(str: string): string {
    // 简化 hash，生产环境使用 crypto.createHash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // 获取有记录的所有日期列表
  async getDatesWithRecords(userId: string, limit: number = 365) {
    // 使用 QueryBuilder 获取所有记录，然后手动提取和去重日期
    const records = await this.recordRepo.createQueryBuilder('record')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .orderBy('record.recordDate', 'DESC')
      .getMany();

    // 使用 Set 去重日期
    const dateSet = new Set<string>();
    
    for (const record of records) {
      // 处理 recordDate 可能是 Date 或 string 的情况
      const recordDate: any = record.recordDate;
      let dateStr: string;
      
      if (recordDate instanceof Date) {
        dateStr = recordDate.toISOString().split('T')[0];
      } else if (typeof recordDate === 'string') {
        dateStr = recordDate.split('T')[0];
      } else {
        dateStr = new Date(recordDate).toISOString().split('T')[0];
      }
      
      dateSet.add(dateStr);
    }

    // 转换为数组并限制数量
    const uniqueDates = Array.from(dateSet).slice(0, limit);
    
    return uniqueDates.map(date => ({
      date,
      hasRecord: true,
    }));
  }

  // 获取有记录的所有周列表
  async getWeeksWithRecords(userId: string, limit: number = 52) {
    const records = await this.recordRepo.createQueryBuilder('record')
      .select('DISTINCT record.recordDate', 'date')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .orderBy('record.recordDate', 'DESC')
      .getRawMany();

    // 按周分组
    const weekMap = new Map<string, { weekStart: string; weekEnd: string; hasRecord: boolean; recordCount: number }>();
    
    for (const r of records) {
      const date = new Date(r.date);
      // 计算本周开始（周一）
      const dayOfWeek = date.getDay() || 7; // 周日为0，转为7
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dayOfWeek + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekStart: weekKey,
          weekEnd: weekEnd.toISOString().split('T')[0],
          hasRecord: true,
          recordCount: 1,
        });
      } else {
        const week = weekMap.get(weekKey)!;
        week.recordCount++;
      }
    }

    return Array.from(weekMap.values())
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, limit);
  }

  // 获取有记录的所有月列表
  async getMonthsWithRecords(userId: string, limit: number = 24) {
    const records = await this.recordRepo.createQueryBuilder('record')
      .select('DISTINCT DATE_TRUNC(\'month\', record.recordDate)', 'month')
      .where('record.userId = :userId', { userId })
      .andWhere('record.deletedAt IS NULL')
      .orderBy('month', 'DESC')
      .limit(limit)
      .getRawMany();

    return records.map(r => {
      const monthDate = new Date(r.month);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      return {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        label: `${year}年${month}月`,
        hasRecord: true,
      };
    });
  }

  // 检查饮食记录相关成就
  private async checkRecordAchievements(userId: string, inputMethod: string, recordDate: Date, mealType: string) {
    // 初次记录
    await this.achievementService.unlock(userId, 'first_record').catch(() => {});

    // 拍照大师（拍照识别）
    if (inputMethod === 'photo') {
      await this.achievementService.unlock(userId, 'photo_master').catch(() => {});
    }

    // 记录次数类成就
    const totalRecords = await this.recordRepo.count({ where: { userId } });
    if (totalRecords >= 10) {
      await this.achievementService.unlock(userId, 'record_10').catch(() => {});
    }
    if (totalRecords >= 50) {
      await this.achievementService.unlock(userId, 'record_50').catch(() => {});
    }
    if (totalRecords >= 100) {
      await this.achievementService.unlock(userId, 'record_100').catch(() => {});
    }

    // 连续记录天数
    const consecutiveDays = await this.getConsecutiveRecordDays(userId);
    if (consecutiveDays >= 3) await this.achievementService.unlock(userId, 'streak_3').catch(() => {});
    if (consecutiveDays >= 7) await this.achievementService.unlock(userId, 'streak_7').catch(() => {});
    if (consecutiveDays >= 14) await this.achievementService.unlock(userId, 'streak_14').catch(() => {});
    if (consecutiveDays >= 30) await this.achievementService.unlock(userId, 'streak_30').catch(() => {});
    if (consecutiveDays >= 100) await this.achievementService.unlock(userId, 'streak_100').catch(() => {});

    // 早起鸟（连续7天在8点前记录早餐）
    if (mealType === 'breakfast') {
      const hour = recordDate.getHours();
      if (hour < 8) {
        const earlyBirdDays = await this.getConsecutiveEarlyBreakfastDays(userId);
        if (earlyBirdDays >= 7) {
          await this.achievementService.unlock(userId, 'early_bird').catch(() => {});
        }
      }
    }

    // 蔬菜爱好者
    const veggieCount = await this.getTotalVeggieItems(userId);
    if (veggieCount >= 30) {
      await this.achievementService.unlock(userId, 'veggie_lover').catch(() => {});
    }

    // 喝水达人（简化判断：记录中包含液体食物或notes中注明喝水）
    const waterCount = await this.getTotalWaterRecords(userId);
    if (waterCount >= 7) {
      await this.achievementService.unlock(userId, 'water_tracker').catch(() => {});
    }

    // 均衡饮食类成就（基于每日数据）
    await this.checkDailyBalanceAchievements(userId);
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
      where: { userId, mealType: 'breakfast' as MealType },
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

  private async checkDailyBalanceAchievements(userId: string) {
    const profile = await this.userService.getProfile(userId).catch(() => null);
    const calorieGoal = profile?.dailyCalorieGoal || 2000;
    const proteinGoal = profile?.weightKg ? profile.weightKg * 1.2 : 60;
    const carbsGoal = profile?.dailyCalorieGoal ? (profile.dailyCalorieGoal * 0.5) / 4 : 250;
    const fatGoal = profile?.dailyCalorieGoal ? (profile.dailyCalorieGoal * 0.3) / 9 : 65;

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

    // 按日期汇总
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

    const caloriePerfectDays = this.getConsecutiveTrueFromStart(calorieMet);
    const proteinDays = this.getConsecutiveTrueFromStart(proteinMet);
    const balancedDays = this.getConsecutiveTrueFromStart(balancedMet);
    const sugarControlDays = this.getConsecutiveTrueFromStart(sugarControlMet);

    if (caloriePerfectDays >= 5) await this.achievementService.unlock(userId, 'calorie_perfect').catch(() => {});
    if (proteinDays >= 7) await this.achievementService.unlock(userId, 'protein_master').catch(() => {});
    if (balancedDays >= 3) await this.achievementService.unlock(userId, 'balanced_diet').catch(() => {});
    if (sugarControlDays >= 7) await this.achievementService.unlock(userId, 'sugar_control').catch(() => {});
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
