/**
 * 简单的食物数据初始化脚本
 * 运行: node seed-food.js
 */
const { Client } = require('pg');

const commonFoods = [
  { name: '米饭', category: '主食', calories_per_100g: 116, protein_per_100g: 2.6, carbs_per_100g: 25.9, fat_per_100g: 0.3, default_portion_g: 150, is_verified: true },
  { name: '馒头', category: '主食', calories_per_100g: 223, protein_per_100g: 7.0, carbs_per_100g: 47.0, fat_per_100g: 1.1, default_portion_g: 100, is_verified: true },
  { name: '面条', category: '主食', calories_per_100g: 137, protein_per_100g: 4.5, carbs_per_100g: 28.0, fat_per_100g: 0.5, default_portion_g: 200, is_verified: true },
  { name: '鸡蛋', category: '肉类', calories_per_100g: 144, protein_per_100g: 13.3, carbs_per_100g: 2.8, fat_per_100g: 8.8, default_portion_g: 50, is_verified: true },
  { name: '鸡胸肉', category: '肉类', calories_per_100g: 165, protein_per_100g: 31.0, carbs_per_100g: 0, fat_per_100g: 3.6, default_portion_g: 150, is_verified: true },
  { name: '猪肉', category: '肉类', calories_per_100g: 242, protein_per_100g: 14.0, carbs_per_100g: 0, fat_per_100g: 20.0, default_portion_g: 100, is_verified: true },
  { name: '牛肉', category: '肉类', calories_per_100g: 125, protein_per_100g: 20.0, carbs_per_100g: 0, fat_per_100g: 4.5, default_portion_g: 100, is_verified: true },
  { name: '鱼肉', category: '肉类', calories_per_100g: 100, protein_per_100g: 18.0, carbs_per_100g: 0, fat_per_100g: 2.5, default_portion_g: 150, is_verified: true },
  { name: '西红柿', category: '蔬菜', calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2, default_portion_g: 200, is_verified: true },
  { name: '黄瓜', category: '蔬菜', calories_per_100g: 15, protein_per_100g: 0.7, carbs_per_100g: 3.6, fat_per_100g: 0.1, default_portion_g: 200, is_verified: true },
  { name: '白菜', category: '蔬菜', calories_per_100g: 13, protein_per_100g: 1.0, carbs_per_100g: 2.5, fat_per_100g: 0.2, default_portion_g: 200, is_verified: true },
  { name: '西兰花', category: '蔬菜', calories_per_100g: 34, protein_per_100g: 2.8, carbs_per_100g: 7.0, fat_per_100g: 0.4, default_portion_g: 150, is_verified: true },
  { name: '胡萝卜', category: '蔬菜', calories_per_100g: 41, protein_per_100g: 0.9, carbs_per_100g: 9.6, fat_per_100g: 0.2, default_portion_g: 150, is_verified: true },
  { name: '土豆', category: '蔬菜', calories_per_100g: 77, protein_per_100g: 2.0, carbs_per_100g: 17.0, fat_per_100g: 0.1, default_portion_g: 200, is_verified: true },
  { name: '苹果', category: '水果', calories_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 14.0, fat_per_100g: 0.2, default_portion_g: 200, is_verified: true },
  { name: '香蕉', category: '水果', calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 22.8, fat_per_100g: 0.3, default_portion_g: 120, is_verified: true },
  { name: '橙子', category: '水果', calories_per_100g: 47, protein_per_100g: 0.9, carbs_per_100g: 11.8, fat_per_100g: 0.1, default_portion_g: 150, is_verified: true },
  { name: '牛奶', category: '饮品', calories_per_100g: 54, protein_per_100g: 3.0, carbs_per_100g: 4.8, fat_per_100g: 3.0, default_portion_g: 250, is_verified: true },
  { name: '豆浆', category: '饮品', calories_per_100g: 31, protein_per_100g: 3.0, carbs_per_100g: 1.2, fat_per_100g: 1.6, default_portion_g: 250, is_verified: true },
  { name: '酸奶', category: '饮品', calories_per_100g: 72, protein_per_100g: 3.5, carbs_per_100g: 9.0, fat_per_100g: 2.5, default_portion_g: 200, is_verified: true },
  { name: '咖啡', category: '饮品', calories_per_100g: 2, protein_per_100g: 0.1, carbs_per_100g: 0.3, fat_per_100g: 0, default_portion_g: 200, is_verified: true },
];

async function seedFoodData() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'dietwise',
    user: 'postgres',
    password: '333777',
  });

  try {
    await client.connect();
    console.log('连接数据库成功');

    // 检查是否已有数据
    const countResult = await client.query('SELECT COUNT(*) FROM food_items');
    const count = parseInt(countResult.rows[0].count);
    
    if (count > 0) {
      console.log(`食物库已有 ${count} 条数据，跳过初始化`);
      return;
    }

    console.log(`准备导入 ${commonFoods.length} 种食物...`);

    for (const food of commonFoods) {
      await client.query(`
        INSERT INTO food_items (
          id, name, category, calories_per_100g, protein_per_100g, 
          carbs_per_100g, fat_per_100g, default_portion_g, is_verified, 
          source, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'seed', NOW(), NOW()
        )
      `, [
        food.name, food.category, food.calories_per_100g, food.protein_per_100g,
        food.carbs_per_100g, food.fat_per_100g, food.default_portion_g, food.is_verified
      ]);
    }

    console.log('✅ 食物库初始化完成！');
  } catch (error) {
    console.error('初始化失败:', error.message);
  } finally {
    await client.end();
  }
}

seedFoodData();
