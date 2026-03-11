import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MealPlanDay } from './meal-plan-day.entity';

export enum PlanType {
  CUSTOM = 'custom',
  AI = 'ai',
}

export enum PlanStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('meal_plans')
export class MealPlan extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: PlanType, default: PlanType.CUSTOM })
  type: PlanType;

  @Column({ type: 'integer', name: 'calorie_target' })
  calorieTarget: number;

  @Column({ type: 'smallint', name: 'meal_count' })
  mealCount: number;

  @Column({ type: 'varchar', length: 20, name: 'health_goal' })
  healthGoal: string;

  @Column({ type: 'simple-array', name: 'flavor_prefs', default: '' })
  flavorPrefs: string[];

  @Column({ type: 'varchar', length: 20, name: 'ai_provider', nullable: true })
  aiProvider: string;

  @Column({ type: 'integer', name: 'ai_prompt_tokens', nullable: true })
  aiPromptTokens: number;

  @Column({ type: 'integer', name: 'ai_completion_tokens', nullable: true })
  aiCompletionTokens: number;

  @Column({ type: 'date', name: 'week_start_date', nullable: true })
  weekStartDate: Date;

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.ACTIVE })
  status: PlanStatus;

  @OneToMany(() => MealPlanDay, day => day.plan, { cascade: true })
  days: MealPlanDay[];
}
