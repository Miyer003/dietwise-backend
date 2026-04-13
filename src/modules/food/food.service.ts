import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { FoodItem } from './entities/food-item.entity';
import { DietRecordItem } from '../diet/entities/diet-record-item.entity';

// 最近常吃的食物 - 仅包含前端需要的字段
export interface RecentFoodItem {
  id?: string;  // 食物库ID，可能为空（AI识别的自定义食物）
  name: string;
  namePinyin?: string;
  nameAliases?: string[];
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  sodiumPer100g?: number;
  defaultPortionG?: number;
  isVerified?: boolean;
  recordCount: number;
  lastRecordedAt?: Date;
}

@Injectable()
export class FoodService {
  constructor(
    @InjectRepository(FoodItem)
    private readonly foodRepo: Repository<FoodItem>,
    @InjectRepository(DietRecordItem)
    private readonly recordItemRepo: Repository<DietRecordItem>,
  ) {}

  // 按分类获取食物列表（仅返回已核验食物）
  async findByCategory(category?: string, limit: number = 50) {
    const query = this.foodRepo.createQueryBuilder('food')
      .where('food.isVerified = :isVerified', { isVerified: true });

    if (category) {
      query.andWhere('food.category = :category', { category });
    }

    const items = await query
      .addOrderBy('food.name')
      .limit(limit)
      .getMany();

    return items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      caloriesPer100g: item.caloriesPer100g,
      proteinPer100g: item.proteinPer100g,
      carbsPer100g: item.carbsPer100g,
      fatPer100g: item.fatPer100g,
      fiberPer100g: item.fiberPer100g,
      defaultPortionG: item.defaultPortionG,
    }));
  }

  // 搜索食物（中文+拼音模糊搜索，仅返回已核验食物）
  async search(keyword: string, category?: string, limit: number = 20) {
    const query = this.foodRepo.createQueryBuilder('food')
      .where('food.isVerified = :isVerified', { isVerified: true })
      .andWhere('(food.name ILIKE :keyword OR food.namePinyin ILIKE :keyword)', {
        keyword: `%${keyword}%`,
      });

    if (category) {
      query.andWhere('food.category = :category', { category });
    }

    const items = await query
      .addOrderBy('food.name')
      .limit(limit)
      .getMany();

    return items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      caloriesPer100g: item.caloriesPer100g,
      proteinPer100g: item.proteinPer100g,
      carbsPer100g: item.carbsPer100g,
      fatPer100g: item.fatPer100g,
      fiberPer100g: item.fiberPer100g,
      defaultPortionG: item.defaultPortionG,
    }));
  }

  // 获取所有分类（仅包含有已核验食物的分类）
  async getCategories() {
    const categories = await this.foodRepo
      .createQueryBuilder('food')
      .select('DISTINCT food.category', 'category')
      .where('food.isVerified = :isVerified', { isVerified: true })
      .getRawMany();

    return categories.map(c => c.category);
  }

  // 获取食物详情（仅返回已核验食物）
  async findById(id: string) {
    const item = await this.foodRepo.findOne({ where: { id, isVerified: true } });
    if (!item) {
      throw new NotFoundException('食物不存在');
    }
    return item;
  }

  // 获取最近常吃的食物（基于用户饮食记录统计）
  async getRecent(userId: string, limit: number = 10): Promise<RecentFoodItem[]> {
    
    // 查询用户的饮食记录项，统计每种食物的出现次数和最近记录时间
    // 支持两种情况：
    // 1. 有 foodItemId 的记录（来自食物库）- 按 foodItemId 分组
    // 2. 没有 foodItemId 的记录（AI拍照/语音自定义输入）- 按 foodName 分组
    const recentFoods = await this.recordItemRepo
      .createQueryBuilder('item')
      .select([
        'item.foodItemId as "foodItemId"',
        'item.foodName as "foodName"',
        'COUNT(item.id) as "recordCount"',
        'MAX(item.createdAt) as "lastRecordedAt"',
      ])
      .where('item.userId = :userId', { userId })
      .groupBy('item.foodItemId')
      .addGroupBy('item.foodName')
      .orderBy('"recordCount"', 'DESC')
      .addOrderBy('"lastRecordedAt"', 'DESC')
      .limit(limit)
      .getRawMany();



    if (recentFoods.length === 0) {
      // 如果用户没有记录，返回食物库中的前 N 个作为推荐
      // 优先返回已验证的，如果没有则返回任意食物
      let defaultFoods = await this.foodRepo.find({
        where: { isVerified: true },
        order: { name: 'ASC' },
        take: limit,
      });
      
      // 如果没有已验证的食物，返回任意食物
      if (defaultFoods.length === 0) {
        defaultFoods = await this.foodRepo.find({
          order: { createdAt: 'DESC' },
          take: limit,
        });
      }
      

      
      return defaultFoods.map(food => ({
        id: food.id,
        name: food.name,
        namePinyin: food.namePinyin,
        nameAliases: food.nameAliases,
        category: food.category,
        caloriesPer100g: Number(food.caloriesPer100g) || 0,
        proteinPer100g: Number(food.proteinPer100g) || 0,
        carbsPer100g: Number(food.carbsPer100g) || 0,
        fatPer100g: Number(food.fatPer100g) || 0,
        fiberPer100g: Number(food.fiberPer100g) || 0,
        sodiumPer100g: Number(food.sodiumPer100g) || 0,
        defaultPortionG: Number(food.defaultPortionG) || 100,
        isVerified: food.isVerified,
        recordCount: 0,
        lastRecordedAt: undefined,
      }));
    }

    // 获取有 foodItemId 的食物详情
    const foodIds = recentFoods.map(f => f.foodItemId).filter(id => id);
    const foodDetails = await this.foodRepo.findByIds(foodIds);
    const foodMap = new Map(foodDetails.map(f => [f.id, f]));

    // 合并数据 - 返回所有用户吃过的食物
    // 1. 有 foodItemId 的：从食物库获取完整信息
    // 2. 没有 foodItemId 的：使用记录中的 foodName，并尝试模糊匹配食物库
    const result: RecentFoodItem[] = [];
    
    for (const item of recentFoods) {
      const recordCount = parseInt(item.recordCount, 10);
      
      if (item.foodItemId && foodMap.has(item.foodItemId)) {
        // 情况1：有关联的食物库记录
        const food = foodMap.get(item.foodItemId)!;
        result.push({
          id: food.id,
          name: food.name,
          namePinyin: food.namePinyin,
          nameAliases: food.nameAliases,
          category: food.category,
          caloriesPer100g: Number(food.caloriesPer100g) || 0,
          proteinPer100g: Number(food.proteinPer100g) || 0,
          carbsPer100g: Number(food.carbsPer100g) || 0,
          fatPer100g: Number(food.fatPer100g) || 0,
          fiberPer100g: Number(food.fiberPer100g) || 0,
          sodiumPer100g: Number(food.sodiumPer100g) || 0,
          defaultPortionG: Number(food.defaultPortionG) || 100,
          isVerified: food.isVerified,
          recordCount,
          lastRecordedAt: item.lastRecordedAt,
        });
      } else {
        // 情况2：AI识别的自定义食物（没有foodItemId）
        // 尝试根据名字模糊匹配食物库
        const matchedFood = await this.findFoodByName(item.foodName);
        
        if (matchedFood) {
          // 找到匹配的食物，使用食物库数据
          result.push({
            id: matchedFood.id,
            name: item.foodName,  // 保持用户记录的原始名字
            namePinyin: matchedFood.namePinyin,
            nameAliases: matchedFood.nameAliases,
            category: matchedFood.category,
            caloriesPer100g: Number(matchedFood.caloriesPer100g) || 0,
            proteinPer100g: Number(matchedFood.proteinPer100g) || 0,
            carbsPer100g: Number(matchedFood.carbsPer100g) || 0,
            fatPer100g: Number(matchedFood.fatPer100g) || 0,
            fiberPer100g: Number(matchedFood.fiberPer100g) || 0,
            sodiumPer100g: Number(matchedFood.sodiumPer100g) || 0,
            defaultPortionG: Number(matchedFood.defaultPortionG) || 100,
            isVerified: matchedFood.isVerified,
            recordCount,
            lastRecordedAt: item.lastRecordedAt,
          });
        } else {
          // 没有找到匹配，使用自定义数据（无id，表示不在食物库中）
          result.push({
            name: item.foodName,
            category: '其他',
            caloriesPer100g: 0,
            proteinPer100g: 0,
            carbsPer100g: 0,
            fatPer100g: 0,
            fiberPer100g: 0,
            sodiumPer100g: 0,
            defaultPortionG: 100,
            isVerified: false,
            recordCount,
            lastRecordedAt: item.lastRecordedAt,
          });
        }
      }
    }
    
    return result;
  }

  // 语义搜索（RAG）- 简化实现
  async semanticSearch(query: string) {
    // TODO: 实际应使用pgvector进行向量相似度搜索
    // 这里先使用简单的文本搜索作为回退
    return this.search(query, undefined, 10);
  }

  // 根据名字查找食物（模糊匹配，仅返回已核验食物）
  private async findFoodByName(name: string): Promise<FoodItem | null> {
    if (!name) return null;
    
    // 首先尝试精确匹配
    let food = await this.foodRepo.findOne({
      where: { name, isVerified: true },
    });
    
    if (food) return food;
    
    // 尝试包含匹配（名字包含查询词或查询词包含名字）
    const foods = await this.foodRepo
      .createQueryBuilder('food')
      .where('food.isVerified = :isVerified', { isVerified: true })
      .andWhere('(food.name ILIKE :name OR :name ILIKE food.name)', { name: `%${name}%` })
      .orderBy('food.name')
      .limit(1)
      .getMany();
    
    return foods.length > 0 ? foods[0] : null;
  }

  // 批量创建食物（用于导入数据）
  async batchCreate(items: Partial<FoodItem>[]) {
    const foods = items.map(item => this.foodRepo.create(item));
    return this.foodRepo.save(foods);
  }
}
