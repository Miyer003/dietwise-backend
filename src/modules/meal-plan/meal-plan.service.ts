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

    // 同步更新用户 profile 的每日热量目标和饮食设置
    await this.userService.updateProfile(userId, {
      dailyCalorieGoal: dto.calorieTarget,
      mealCount: dto.mealCount,
      healthGoal: dto.healthGoal,
      flavorPrefs: dto.flavorPrefs,
    });

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
      age: this.calculateAge(profile.birthDate) ?? 25,
      gender: profile.gender,
      // 高级设置
      restrictions: (dto as any).restrictions || [],
      cookingDifficulty: (dto as any).cookingDifficulty,
    };

    // 调用AI生成食谱，传递自定义要求
    const customRequest = (dto as any).customRequest;
    const aiResult = await this.aiService.generateMealPlan(userProfile, customRequest);

    // 解析AI返回的食谱数据
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

    // 同步更新用户 profile 的每日热量目标和饮食设置
    await this.userService.updateProfile(userId, {
      dailyCalorieGoal: userProfile.dailyCalorieGoal,
      mealCount: userProfile.mealCount,
      healthGoal: userProfile.healthGoal,
      flavorPrefs: userProfile.flavorPrefs,
    });

    return this.getById(userId, saved.id);
  }

  // 更新食谱（支持部分更新）
  async update(userId: string, id: string, dto: any) {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['days'],
    });

    if (!plan) {
      throw new NotFoundException('食谱不存在');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException('无权修改此食谱');
    }

    // 更新基本设置
    const updateData: any = {};
    if (dto.calorieTarget !== undefined) updateData.calorieTarget = dto.calorieTarget;
    if (dto.mealCount !== undefined) updateData.mealCount = dto.mealCount;
    if (dto.healthGoal !== undefined) updateData.healthGoal = dto.healthGoal;
    if (dto.flavorPrefs !== undefined) updateData.flavorPrefs = dto.flavorPrefs;
    
    if (Object.keys(updateData).length > 0) {
      await this.planRepo.update(id, updateData);
    }

    // 如果需要更新菜单
    if (dto.updateDays && dto.days && dto.days.length > 0) {
      // 删除旧的days
      await this.dayRepo.delete({ planId: id });
      
      // 创建新的days
      const dayEntities = dto.days.map((day: any) =>
        this.dayRepo.create({
          planId: id,
          dayOfWeek: day.dayOfWeek,
          mealType: day.mealType,
          dishes: day.dishes.map((d: any) => ({
            name: d.name,
            quantity_g: d.quantityG || d.quantity_g || 100,
            calories: d.calories,
            protein_g: d.proteinG || d.protein_g || 0,
            carbs_g: d.carbsG || d.carbs_g || 0,
            fat_g: d.fatG || d.fat_g || 0,
            cooking_tip: d.cookingTip || d.cooking_tip || '',
          })),
          totalCalories: day.totalCalories,
          notes: day.notes || '',
        }),
      );
      await this.dayRepo.save(dayEntities);
    }

    // 同步更新用户profile
    const profileUpdate: any = {};
    if (dto.calorieTarget !== undefined) profileUpdate.dailyCalorieGoal = dto.calorieTarget;
    if (dto.mealCount !== undefined) profileUpdate.mealCount = dto.mealCount;
    if (dto.healthGoal !== undefined) profileUpdate.healthGoal = dto.healthGoal;
    if (dto.flavorPrefs !== undefined) profileUpdate.flavorPrefs = dto.flavorPrefs;
    
    if (Object.keys(profileUpdate).length > 0) {
      await this.userService.updateProfile(userId, profileUpdate);
    }

    return this.getById(userId, id);
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
      planType: plan.type,  // 统一字段名为 planType
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
      // 清理AI响应，去除markdown代码块标记
      let cleanText = aiText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      
      // 尝试找到JSON开始的位置（第一个{）
      const jsonStartIndex = cleanText.indexOf('{');
      const jsonEndIndex = cleanText.lastIndexOf('}');
      
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonStartIndex < jsonEndIndex) {
        const jsonString = cleanText.substring(jsonStartIndex, jsonEndIndex + 1);
        
        try {
          const parsed = JSON.parse(jsonString);

          
          // 处理新的结构化格式 { days: [{ dayOfWeek, meals: [...], dailyNutrition }] }
          if (parsed.days && Array.isArray(parsed.days)) {

            
            for (const day of parsed.days) {
              
              if (day.meals && Array.isArray(day.meals)) {
                for (const meal of day.meals) {
                  const dishes = (meal.dishes || []).map((d: any) => ({
                    name: d.name || '未知菜品',
                    quantity_g: parseInt(d.quantityG || d.quantity_g) || 100,
                    calories: parseInt(d.calories) || 0,
                    protein_g: parseFloat(d.proteinG || d.protein_g) || 0,
                    carbs_g: parseFloat(d.carbsG || d.carbs_g) || 0,
                    fat_g: parseFloat(d.fatG || d.fat_g) || 0,
                    cooking_tip: d.cookingTip || d.cooking_tip || '',
                  }));
                  
                  // 构建营养信息字符串
                  let nutritionNotes = '';
                  if (day.dailyNutrition) {
                    const { proteinG, carbsG, fatG, proteinPercent, carbsPercent, fatPercent } = day.dailyNutrition;
                    nutritionNotes = `蛋白质:${proteinG}g (${proteinPercent}%) 碳水:${carbsG}g (${carbsPercent}%) 脂肪:${fatG}g (${fatPercent}%)`;
                  } else if (meal.mealProtein || meal.mealCarbs || meal.mealFat) {
                    nutritionNotes = `本餐 蛋白质:${meal.mealProtein || 0}g 碳水:${meal.mealCarbs || 0}g 脂肪:${meal.mealFat || 0}g`;
                  }
                  
                  const totalCalories = parseInt(meal.mealCalories) || dishes.reduce((sum: number, d: any) => sum + (d.calories || 0), 0);
                  

                  
                  days.push({
                    dayOfWeek: day.dayOfWeek || 1,
                    mealType: meal.mealType || 'breakfast',
                    dishes,
                    totalCalories,
                    notes: nutritionNotes,
                  });
                }
              }
            }
            
            if (days.length > 0) {
              return { days };
            }
          }
          
          // 兼容旧格式 { days: [{ dayOfWeek, mealType, dishes }] }
          if (parsed.days && Array.isArray(parsed.days) && parsed.days[0]?.mealType) {
            return { days: parsed.days };
          }
        } catch (jsonError: any) {
          // JSON解析失败，继续尝试正则提取
        }
      }

      // 如果JSON解析失败，使用正则表达式提取
      // 匹配每一天的食谱（周一至周日）
      const lines = cleanText.split('\n');
      let currentDay = 1;
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
      // 解析失败，返回默认结构
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
  private calculateAge(birthDate: Date): number | null {
    if (!birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - new Date(birthDate).getFullYear();
    const monthDiff = today.getMonth() - new Date(birthDate).getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < new Date(birthDate).getDate())) {
      age--;
    }
    return age;
  }
}
