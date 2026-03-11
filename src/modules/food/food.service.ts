import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { FoodItem } from './entities/food-item.entity';

@Injectable()
export class FoodService {
  constructor(
    @InjectRepository(FoodItem)
    private readonly foodRepo: Repository<FoodItem>,
  ) {}

  // 搜索食物（中文+拼音模糊搜索）
  async search(keyword: string, category?: string, limit: number = 20) {
    const query = this.foodRepo.createQueryBuilder('food')
      .where('food.name ILIKE :keyword OR food.namePinyin ILIKE :keyword', {
        keyword: `%${keyword}%`,
      });

    if (category) {
      query.andWhere('food.category = :category', { category });
    }

    const items = await query
      .orderBy('food.isVerified', 'DESC')
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

  // 获取所有分类
  async getCategories() {
    const categories = await this.foodRepo
      .createQueryBuilder('food')
      .select('DISTINCT food.category', 'category')
      .getRawMany();

    return categories.map(c => c.category);
  }

  // 获取食物详情
  async findById(id: string) {
    const item = await this.foodRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('食物不存在');
    }
    return item;
  }

  // 获取最近常吃的食物（简化实现，实际应根据用户的diet_records统计）
  async getRecent(userId: string) {
    // TODO: 实际应该查询diet_record_items，获取用户最常记录的食物
    // 这里返回一些常见的食物作为示例
    return this.foodRepo.find({
      where: { isVerified: true },
      order: { name: 'ASC' },
      take: 10,
    });
  }

  // 语义搜索（RAG）- 简化实现
  async semanticSearch(query: string) {
    // TODO: 实际应使用pgvector进行向量相似度搜索
    // 这里先使用简单的文本搜索作为回退
    return this.search(query, undefined, 10);
  }

  // 批量创建食物（用于导入数据）
  async batchCreate(items: Partial<FoodItem>[]) {
    const foods = items.map(item => this.foodRepo.create(item));
    return this.foodRepo.save(foods);
  }
}
