import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MealPlan } from './meal-plan.entity';
import { MealType } from '../../diet/entities/diet-record.entity';

@Entity('meal_plan_days')
export class MealPlanDay extends BaseEntity {
  @Column({ type: 'uuid', name: 'plan_id' })
  planId: string;

  @ManyToOne(() => MealPlan, plan => plan.days)
  @JoinColumn({ name: 'plan_id' })
  plan: MealPlan;

  @Column({ type: 'smallint', name: 'day_of_week' })
  dayOfWeek: number; // 1(周一) - 7(周日)

  @Column({ type: 'enum', enum: MealType })
  mealType: MealType;

  @Column({ type: 'jsonb' })
  dishes: DishItem[];

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'total_calories' })
  totalCalories: number;

  @Column({ type: 'text', nullable: true })
  notes: string; // 烹饪建议
}

export interface DishItem {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  cooking_tip?: string;
}
