import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
// 需要安装 vector 类型支持，这里使用字符串存储向量

@Entity('food_items')
export class FoodItem extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  @Index({ fulltext: true })
  name: string;

  @Column({ type: 'varchar', length: 200, name: 'name_pinyin', nullable: true })
  namePinyin: string;

  @Column({ type: 'simple-array', name: 'name_aliases', default: '' })
  nameAliases: string[];

  @Column({ type: 'varchar', length: 30 })
  category: string; // 主食/肉类/蔬菜/水果/饮品/其他

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'calories_per_100g' })
  caloriesPer100g: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'protein_per_100g' })
  proteinPer100g: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'carbs_per_100g' })
  carbsPer100g: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'fat_per_100g' })
  fatPer100g: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'fiber_per_100g', default: 0 })
  fiberPer100g: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'sodium_per_100g', default: 0 })
  sodiumPer100g: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, name: 'default_portion_g', default: 100 })
  defaultPortionG: number;

  // 向量存储，使用 pgvector，这里先用文本存储，实际使用需要 typeorm 扩展支持
  @Column({ type: 'text', nullable: true })
  embedding: string;

  @Column({ type: 'varchar', length: 20, default: 'ai_generated' })
  source: string;

  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified: boolean;
}