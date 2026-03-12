import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealPlan, PlanType, PlanStatus } from './entities/meal-plan.entity';
import { MealPlanDay } from './entities/meal-plan-day.entity';
import { CreateMealPlanDto, GenerateMealPlanDto } from './dto/meal-plan.dto';
import { AIService } from '../../shared/ai/ai.service';
import { UserService } from '../user/user.service';

@Injectable()
export class MealPlanService {
  constructor(
    @InjectRepository(MealPlan)
    private readonly planRepo: Repository<MealPlan>,
    @InjectRepository(MealPlanDay)
    private readonly dayRepo: Repository<MealPlanDay>,
    private readonly aiService: AIService,
    private readonly userService: UserService,
  ) {}

  // 获取当前激活的食谱
  async getActive(userId: string) {
    const plan = await this.planRepo.findOne({
      where: { userId, status: PlanStatus.ACTIVE },
      relations: ['days'],
      order: { createdAt: 'DESC' },
    });

    if (!plan) {
      // 返回空模板
      const profile = await this.userService.getProfile(userId).catch(() => null);
      return {
        hasPlan: false,
        calorieTarget: profile?.dailyCalorieGoal || 2000,
        mealCount: profile?.mealCount || 3,
        healthGoal: profile?.healthGoal || '维持',
        flavorPrefs: profile?.flavorPrefs || [],
        days: [],
      };
    }

    return this.formatPlanResponse(plan);
  }

  // 获取食谱列表
  async getList(userId: string, page: number = 1, limit: number = 20) {
    const [plans, total] = await this.planRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: plans.map(plan => ({
        id: plan.id,
        type: plan.type,
        calorieTarget: plan.calorieTarget,
        mealCount: plan.mealCount,
        healthGoal: plan.healthGoal,
        status: plan.status,
        createdAt: plan.createdAt,
      })),
    };
  }

  // 获取食谱详情
  async getById(userId: string, id: string) {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['days'],
    });

    if (!plan) {
      throw new NotFoundException('食谱不存在');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException('无权访问此食谱');
    }

    return this.formatPlanResponse(plan);
  }

  // 创建自定义食谱
  async create(userId: string, dto: CreateMealPlanDto) {
    const plan = this.planRepo.create({
      userId,
      type: PlanType.CUSTOM,
      calorieTarget: dto.calorieTarget,
      mealCount: dto.mealCount,
      healthGoal: dto.healthGoal,
      flavorPrefs: dto.flavorPrefs || [],
      status: PlanStatus.ACTIVE,
    });

    // 保存前先归档其他激活的食谱
    await this.archiveOtherActive(userId);

    const saved = await this.planRepo.save(plan);

    // 如果有天的数据，保存明细
    if (dto.days && dto.days.length > 0) {
      const dayEntities = dto.days.map(day =>
        this.dayRepo.create({
          planId: saved.id,
          dayOfWeek: day.dayOfWeek,
          mealType: day.mealType,
          dishes: day.dishes,
          totalCalories: day.totalCalories,
          notes: (day as any).notes || '',
        }),
      );
      await this.dayRepo.save(dayEntities);
    }

    return this.getById(userId, saved.id);
  }

  // AI生成食谱
  async generate(userId: string, dto: GenerateMealPlanDto) {
    const profile = await this.userService.getProfile(userId);

    // 构建用户画像数据
    const userProfile = {
      heightCm: dto.heightCm || profile.heightCm,
      weightKg: dto.weightKg || profile.weightKg,
      healthGoal: dto.healthGoal || profile.healthGoal || '维持',
      dailyCalorieGoal: dto.calorieTarget || profile.dailyCalorieGoal || 2000,
      mealCount: dto.mealCount || profile.mealCount || 3,
      flavorPrefs: dto.flavorPrefs || profile.flavorPrefs || [],
      allergyTags: profile.allergyTags || [],
      age: this.calculateAge(profile.birthDate),
      gender: profile.gender,
    };

    // 调用AI生成食谱
    const aiResult = await this.aiService.generateMealPlan(userProfile);

    // 解析AI返回的食谱数据（简化实现）
    const parsedPlan = this.parseAIResponse(aiResult);

    // 创建食谱记录
    const plan = this.planRepo.create({
      userId,
      type: PlanType.AI,
      calorieTarget: userProfile.dailyCalorieGoal,
      mealCount: userProfile.mealCount,
      healthGoal: userProfile.healthGoal,
      flavorPrefs: userProfile.flavorPrefs,
      aiProvider: 'kimi-v1',
      status: PlanStatus.ACTIVE,
    });

    await this.archiveOtherActive(userId);
    const saved = await this.planRepo.save(plan);

    // 保存天的明细
    if (parsedPlan.days.length > 0) {
      const dayEntities = parsedPlan.days.map(day =>
        this.dayRepo.create({
          planId: saved.id,
          dayOfWeek: day.dayOfWeek,
          mealType: day.mealType as any,
          dishes: day.dishes,
          totalCalories: day.totalCalories,
          notes: (day as any).notes || '',
        }),
      );
      await this.dayRepo.save(dayEntities);
    }

    return this.getById(userId, saved.id);
  }

  // 激活食谱
  async activate(userId: string, id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException('食谱不存在');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException('无权操作此食谱');
    }

    await this.archiveOtherActive(userId);
    await this.planRepo.update(id, { status: PlanStatus.ACTIVE });

    return this.getById(userId, id);
  }

  // 删除食谱
  async delete(userId: string, id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException('食谱不存在');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException('无权删除此食谱');
    }

    await this.planRepo.softDelete(id);
  }

  // 归档其他激活的食谱
  private async archiveOtherActive(userId: string) {
    await this.planRepo.update(
      { userId, status: PlanStatus.ACTIVE },
      { status: PlanStatus.ARCHIVED },
    );
  }

  // 格式化食谱响应
  private formatPlanResponse(plan: MealPlan) {
    const daysMap = new Map();
    
    if (plan.days) {
      for (const day of plan.days) {
        if (!daysMap.has(day.dayOfWeek)) {
          daysMap.set(day.dayOfWeek, {
            dayOfWeek: day.dayOfWeek,
            meals: [],
          });
        }
        daysMap.get(day.dayOfWeek).meals.push({
          mealType: day.mealType,
          dishes: day.dishes,
          totalCalories: day.totalCalories,
          notes: day.notes,
        });
      }
    }

    return {
      id: plan.id,
      type: plan.type,
      calorieTarget: plan.calorieTarget,
      mealCount: plan.mealCount,
      healthGoal: plan.healthGoal,
      flavorPrefs: plan.flavorPrefs,
      status: plan.status,
      createdAt: plan.createdAt,
      days: Array.from(daysMap.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    };
  }

  // 解析AI响应
  private parseAIResponse(aiText: string): {
    days: Array<{
      dayOfWeek: number;
      mealType: string;
      dishes: Array<{ name: string; quantityG: number; calories: number; cookingTip?: string }>;
      totalCalories: number;
      notes?: string;
    }>;
  } {
    const days: ReturnType<typeof this.parseAIResponse>['days'] = [];

    try {
      // 尝试从AI响应中提取JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.days && Array.isArray(parsed.days)) {
          return { days: parsed.days };
        }
      }

      // 如果JSON解析失败，使用正则表达式提取
      // 匹配每一天的食谱（周一至周日）
      const dayPattern = /周[一二三四五六日]|星期[一二三四五六日]|Day\s*\d+/gi;
      const mealPattern = /(早餐|午餐|晚餐|加餐)\s*[：:]\s*([^\n]+(?:\n(?![早餐|午餐|晚餐|加餐]).*)*)/gi;
      const dishPattern = /[-•*]\s*([^\n（]+)(?:（(\d+)\s*克）)?\s*(?:约?\s*(\d+)\s*[千卡kcal])?/gi;

      let currentDay = 1;
      const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
      let mealIndex = 0;

      // 简单的文本解析逻辑
      const lines = aiText.split('\n');
      let currentMeal = '';
      let currentDishes: typeof days[0]['dishes'] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 检测星期几
        if (/周[一二三四五六日]|星期[一二三四五六日]/i.test(trimmed)) {
          // 保存之前的餐次
          if (currentMeal && currentDishes.length > 0) {
            days.push({
              dayOfWeek: currentDay,
              mealType: currentMeal,
              dishes: currentDishes,
              totalCalories: currentDishes.reduce((sum, d) => sum + (d.calories || 0), 0),
            });
          }
          currentDay = Math.min(currentDay + 1, 7);
          mealIndex = 0;
          currentMeal = '';
          currentDishes = [];
          continue;
        }

        // 检测餐次
        if (trimmed.includes('早餐') || trimmed.toLowerCase().includes('breakfast')) {
          if (currentMeal && currentDishes.length > 0) {
            days.push({
              dayOfWeek: currentDay,
              mealType: currentMeal,
              dishes: currentDishes,
              totalCalories: currentDishes.reduce((sum, d) => sum + (d.calories || 0), 0),
            });
          }
          currentMeal = 'breakfast';
          currentDishes = [];
          continue;
        }
        if (trimmed.includes('午餐') || trimmed.toLowerCase().includes('lunch')) {
          if (currentMeal && currentDishes.length > 0) {
            days.push({
              dayOfWeek: currentDay,
              mealType: currentMeal,
              dishes: currentDishes,
              totalCalories: currentDishes.reduce((sum, d) => sum + (d.calories || 0), 0),
            });
          }
          currentMeal = 'lunch';
          currentDishes = [];
          continue;
        }
        if (trimmed.includes('晚餐') || trimmed.toLowerCase().includes('dinner')) {
          if (currentMeal && currentDishes.length > 0) {
            days.push({
              dayOfWeek: currentDay,
              mealType: currentMeal,
              dishes: currentDishes,
              totalCalories: currentDishes.reduce((sum, d) => sum + (d.calories || 0), 0),
            });
          }
          currentMeal = 'dinner';
          currentDishes = [];
          continue;
        }
        if (trimmed.includes('加餐') || trimmed.toLowerCase().includes('snack')) {
          if (currentMeal && currentDishes.length > 0) {
            days.push({
              dayOfWeek: currentDay,
              mealType: currentMeal,
              dishes: currentDishes,
              totalCalories: currentDishes.reduce((sum, d) => sum + (d.calories || 0), 0),
            });
          }
          currentMeal = 'snack';
          currentDishes = [];
          continue;
        }

        // 解析菜品
        if (currentMeal && (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*'))) {
          const dishMatch = trimmed.match(/[-•*]\s*([^（\(]+)(?:[（(](\d+)\s*[克g][)）])?\s*(?:约?\s*(\d+)\s*[千卡kcal]?)?/i);
          if (dishMatch) {
            currentDishes.push({
              name: dishMatch[1].trim(),
              quantityG: parseInt(dishMatch[2]) || 100,
              calories: parseInt(dishMatch[3]) || 0,
            });
          }
        }
      }

      // 保存最后一个餐次
      if (currentMeal && currentDishes.length > 0) {
        days.push({
          dayOfWeek: currentDay,
          mealType: currentMeal,
          dishes: currentDishes,
          totalCalories: currentDishes.reduce((sum, d) => sum + (d.calories || 0), 0),
        });
      }
    } catch (error) {
      console.error('解析AI食谱响应失败:', error);
    }

    // 如果没有解析到任何数据，返回默认结构
    if (days.length === 0) {
      // 生成默认的一周食谱结构
      for (let day = 1; day <= 7; day++) {
        for (const meal of ['breakfast', 'lunch', 'dinner']) {
          days.push({
            dayOfWeek: day,
            mealType: meal,
            dishes: [{ name: '均衡营养餐', quantityG: 300, calories: 500 }],
            totalCalories: 500,
            notes: 'AI生成的食谱',
          });
        }
      }
    }

    return { days };
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
}
