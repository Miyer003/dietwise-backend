import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { DietRecordItem } from './diet-record-item.entity';

export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
}

export enum InputMethod {
  PHOTO = 'photo',
  VOICE = 'voice',
  MANUAL = 'manual',
}

@Entity('diet_records')
export class DietRecord extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, user => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date', name: 'record_date' })
  recordDate: Date;

  @Column({ type: 'enum', enum: MealType })
  mealType: MealType;

  @Column({ type: 'smallint', name: 'meal_seq', default: 1 })
  mealSeq: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'total_calories', default: 0 })
  totalCalories: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'total_protein', default: 0 })
  totalProtein: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'total_carbs', default: 0 })
  totalCarbs: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'total_fat', default: 0 })
  totalFat: number;

  @Column({ type: 'enum', enum: InputMethod, name: 'input_method' })
  inputMethod: InputMethod;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => DietRecordItem, item => item.record, { cascade: true })
  items: DietRecordItem[];
}