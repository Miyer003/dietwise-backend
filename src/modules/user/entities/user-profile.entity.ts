import { Entity, Column, OneToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, user => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ type: 'date', name: 'birth_date', nullable: true })
  birthDate: Date;

  @Column({ type: 'decimal', precision: 5, scale: 1, name: 'height_cm', nullable: true })
  heightCm: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, name: 'weight_kg', nullable: true })
  weightKg: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, name: 'target_weight_kg', nullable: true })
  targetWeightKg: number;

  @Column({ type: 'varchar', length: 20, name: 'health_goal', nullable: true })
  healthGoal: string;

  @Column({ type: 'varchar', length: 20, name: 'activity_level', nullable: true })
  activityLevel: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  bmr: number;

  @Column({ type: 'integer', name: 'daily_calorie_goal', nullable: true })
  dailyCalorieGoal: number;

  @Column({ type: 'smallint', name: 'meal_count', default: 3 })
  mealCount: number;

  @Column({ type: 'simple-array', name: 'diet_tags', default: '' })
  dietTags: string[];

  @Column({ type: 'simple-array', name: 'allergy_tags', default: '' })
  allergyTags: string[];

  @Column({ type: 'simple-array', name: 'flavor_prefs', default: '' })
  flavorPrefs: string[];

  @Column({ type: 'simple-array', name: 'ai_portrait_tags', default: '' })
  aiPortraitTags: string[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  bio: string;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}