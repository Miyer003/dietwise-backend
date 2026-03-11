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

  // 解析AI响应（简化实现）
  private parseAIResponse(aiText: string) {
    // TODO: 实现更完善的解析逻辑
    // 这里返回一个示例结构
    return {
      days: [
        {
          dayOfWeek: 1,
          mealType: 'breakfast',
          dishes: [{ name: '燕麦粥', quantity_g: 200, calories: 150 }],
          totalCalories: 150,
        },
      ],
    };
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
