import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DietRecord, MealType } from './entities/diet-record.entity';
import { DietRecordItem } from './entities/diet-record-item.entity';
import { CreateDietRecordDto, UpdateDietRecordDto } from './dto/create-diet-record.dto';
import { AIService } from '../../shared/ai/ai.service';
import { RedisService } from '../../shared/redis/redis.service';
import { MinioService } from '../../shared/minio/minio.service';

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
    const date = saved.recordDate.toISOString().split('T')[0];
    await this.redisService.del(`diet:daily:${userId}:${date}`);

    return saved;
  }

  // 删除记录
  async deleteRecord(userId: string, id: string) {
    const record = await this.getRecordById(userId, id);
    const date = record.recordDate.toISOString().split('T')[0];
    
    await this.recordRepo.softDelete(id);
    
    // 清除缓存
    await this.redisService.del(`diet:daily:${userId}:${date}`);
  }

  // 获取每日摘要（带缓存）
  async getDailySummary(userId: string, date: string) {
    const cacheKey = `diet:daily:${userId}:${date}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const records = await this.recordRepo.find({
      where: { userId, recordDate: date as any },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    // 获取用户每日目标（简化实现）
    const goal = 2000; // TODO: 从user_profile获取

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
        mealType: r.mealType,
        totalCalories: r.totalCalories,
        items: r.items.map(i => ({
          foodName: i.foodName,
          quantityG: i.quantityG,
          calories: i.calories,
        })),
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
      const date = record.recordDate.toISOString().split('T')[0];
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

    return {
      weekStart,
      days,
      averageCalories: days.reduce((sum, d) => sum + d.calories, 0) / 7,
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
    const daysWithRecords = new Set(records.map(r => r.recordDate.toISOString().split('T')[0])).size;

    return {
      month,
      totalRecords: records.length,
      daysWithRecords,
      averageDailyCalories: daysWithRecords > 0 ? totalCalories / daysWithRecords : 0,
    };
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
}
