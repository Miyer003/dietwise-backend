/**
 * 初始化食物库数据脚本
 * 运行: npx ts-node src/scripts/init-food-data.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FoodService } from '../modules/food/food.service';

const commonFoods = [
  // 主食
  { name: '米饭', category: '主食', caloriesPer100g: 116, proteinPer100g: 2.6, carbsPer100g: 25.9, fatPer100g: 0.3, defaultPortionG: 150, isVerified: true },
  { name: '馒头', category: '主食', caloriesPer100g: 223, proteinPer100g: 7.0, carbsPer100g: 47.0, fatPer100g: 1.1, defaultPortionG: 100, isVerified: true },
  { name: '面条', category: '主食', caloriesPer100g: 137, proteinPer100g: 4.5, carbsPer100g: 28.0, fatPer100g: 0.5, defaultPortionG: 200, isVerified: true },
  { name: '粥', category: '主食', caloriesPer100g: 46, proteinPer100g: 1.1, carbsPer100g: 9.9, fatPer100g: 0.1, defaultPortionG: 300, isVerified: true },
  { name: '玉米', category: '主食', caloriesPer100g: 86, proteinPer100g: 3.2, carbsPer100g: 19.0, fatPer100g: 1.2, defaultPortionG: 200, isVerified: true },
  { name: '红薯', category: '主食', caloriesPer100g: 61, proteinPer100g: 1.1, carbsPer100g: 14.5, fatPer100g: 0.2, defaultPortionG: 200, isVerified: true },
  
  // 肉类
  { name: '鸡蛋', category: '肉类', caloriesPer100g: 144, proteinPer100g: 13.3, carbsPer100g: 2.8, fatPer100g: 8.8, defaultPortionG: 50, isVerified: true },
  { name: '鸡胸肉', category: '肉类', caloriesPer100g: 165, proteinPer100g: 31.0, carbsPer100g: 0, fatPer100g: 3.6, defaultPortionG: 150, isVerified: true },
  { name: '猪肉', category: '肉类', caloriesPer100g: 242, proteinPer100g: 14.0, carbsPer100g: 0, fatPer100g: 20.0, defaultPortionG: 100, isVerified: true },
  { name: '牛肉', category: '肉类', caloriesPer100g: 125, proteinPer100g: 20.0, carbsPer100g: 0, fatPer100g: 4.5, defaultPortionG: 100, isVerified: true },
  { name: '鱼肉', category: '肉类', caloriesPer100g: 100, proteinPer100g: 18.0, carbsPer100g: 0, fatPer100g: 2.5, defaultPortionG: 150, isVerified: true },
  { name: '虾仁', category: '肉类', caloriesPer100g: 85, proteinPer100g: 18.0, carbsPer100g: 0.5, fatPer100g: 0.5, defaultPortionG: 100, isVerified: true },
  
  // 蔬菜
  { name: '西红柿', category: '蔬菜', caloriesPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2, defaultPortionG: 200, isVerified: true },
  { name: '黄瓜', category: '蔬菜', caloriesPer100g: 15, proteinPer100g: 0.7, carbsPer100g: 3.6, fatPer100g: 0.1, defaultPortionG: 200, isVerified: true },
  { name: '白菜', category: '蔬菜', caloriesPer100g: 13, proteinPer100g: 1.0, carbsPer100g: 2.5, fatPer100g: 0.2, defaultPortionG: 200, isVerified: true },
  { name: '菠菜', category: '蔬菜', caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, defaultPortionG: 200, isVerified: true },
  { name: '西兰花', category: '蔬菜', caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7.0, fatPer100g: 0.4, defaultPortionG: 150, isVerified: true },
  { name: '胡萝卜', category: '蔬菜', caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 9.6, fatPer100g: 0.2, defaultPortionG: 150, isVerified: true },
  { name: '土豆', category: '蔬菜', caloriesPer100g: 77, proteinPer100g: 2.0, carbsPer100g: 17.0, fatPer100g: 0.1, defaultPortionG: 200, isVerified: true },
  { name: '茄子', category: '蔬菜', caloriesPer100g: 25, proteinPer100g: 1.0, carbsPer100g: 6.0, fatPer100g: 0.2, defaultPortionG: 200, isVerified: true },
  { name: '青椒', category: '蔬菜', caloriesPer100g: 22, proteinPer100g: 1.0, carbsPer100g: 5.0, fatPer100g: 0.2, defaultPortionG: 150, isVerified: true },
  { name: '豆腐', category: '蔬菜', caloriesPer100g: 76, proteinPer100g: 8.0, carbsPer100g: 1.9, fatPer100g: 4.8, defaultPortionG: 150, isVerified: true },
  
  // 水果
  { name: '苹果', category: '水果', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14.0, fatPer100g: 0.2, defaultPortionG: 200, isVerified: true },
  { name: '香蕉', category: '水果', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3, defaultPortionG: 120, isVerified: true },
  { name: '橙子', category: '水果', caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 11.8, fatPer100g: 0.1, defaultPortionG: 150, isVerified: true },
  { name: '葡萄', category: '水果', caloriesPer100g: 69, proteinPer100g: 0.7, carbsPer100g: 18.0, fatPer100g: 0.2, defaultPortionG: 150, isVerified: true },
  { name: '草莓', category: '水果', caloriesPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3, defaultPortionG: 150, isVerified: true },
  { name: '西瓜', category: '水果', caloriesPer100g: 30, proteinPer100g: 0.6, carbsPer100g: 8.0, fatPer100g: 0.2, defaultPortionG: 300, isVerified: true },
  
  // 饮品
  { name: '牛奶', category: '饮品', caloriesPer100g: 54, proteinPer100g: 3.0, carbsPer100g: 4.8, fatPer100g: 3.0, defaultPortionG: 250, isVerified: true },
  { name: '豆浆', category: '饮品', caloriesPer100g: 31, proteinPer100g: 3.0, carbsPer100g: 1.2, fatPer100g: 1.6, defaultPortionG: 250, isVerified: true },
  { name: '酸奶', category: '饮品', caloriesPer100g: 72, proteinPer100g: 3.5, carbsPer100g: 9.0, fatPer100g: 2.5, defaultPortionG: 200, isVerified: true },
  { name: '咖啡', category: '饮品', caloriesPer100g: 2, proteinPer100g: 0.1, carbsPer100g: 0.3, fatPer100g: 0, defaultPortionG: 200, isVerified: true },
];

async function initFoodData() {
  const app = await NestFactory.create(AppModule);
  const foodService = app.get(FoodService);

  try {
    console.log('开始初始化食物库数据...');
    
    // 检查是否已有数据
    const categories = await foodService.getCategories();
    if (categories.length > 0) {
      console.log(`食物库已有 ${categories.length} 个分类，跳过初始化`);
      console.log('现有分类:', categories);
    } else {
      console.log(`准备导入 ${commonFoods.length} 种食物...`);
      await foodService.batchCreate(commonFoods as any);
      console.log('食物库初始化完成！');
    }
  } catch (error) {
    console.error('初始化失败:', error);
  } finally {
    await app.close();
  }
}

initFoodData();
