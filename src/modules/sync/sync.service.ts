import { Injectable } from '@nestjs/common';
import { DietService } from '../diet/diet.service';
import { MealPlanService } from '../meal-plan/meal-plan.service';
import { NotificationService } from '../notification/notification.service';
import { AchievementService } from '../achievement/achievement.service';
import { PushSyncDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly dietService: DietService,
    private readonly mealPlanService: MealPlanService,
    private readonly notificationService: NotificationService,
    private readonly achievementService: AchievementService,
  ) {}

  // 推送离线数据到云端
  async push(userId: string, dto: PushSyncDto) {
    let successCount = 0;
    let conflictCount = 0;
    const conflicts = [];

    // 同步饮食记录
    if (dto.records && dto.records.length > 0) {
      for (const record of dto.records) {
        try {
          // 检查是否已存在（通过客户端生成的ID或时间戳判断）
          // 简化实现：直接创建
          await this.dietService.createRecord(userId, record);
          successCount++;
        } catch (error) {
          conflictCount++;
          conflicts.push({
            clientId: (record as any)['clientId'],
            error: error.message,
          });
        }
      }
    }

    return {
      successCount,
      conflictCount,
      conflicts,
      serverTime: new Date().toISOString(),
    };
  }

  // 拉取云端数据
  async pull(userId: string, lastSyncAt: string, deviceId: string) {
    const since = new Date(lastSyncAt);
    
    // 获取该日期之后的饮食记录
    const today = new Date().toISOString().split('T')[0];
    const dietRecords = await this.dietService.getRecords(userId, today);

    // 获取当前食谱
    const mealPlan = await this.mealPlanService.getActive(userId);

    // 获取提醒设置
    const notificationSettings = await this.notificationService.getSettings(userId);

    // 获取成就
    const achievements = await this.achievementService.getAll(userId);

    return {
      dietRecords,
      mealPlans: (mealPlan as any).hasPlan === false ? [] : [mealPlan],
      notificationSettings,
      achievements: achievements.achievements,
      serverTime: new Date().toISOString(),
    };
  }
}
