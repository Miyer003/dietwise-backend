import { IsString, IsNumber, IsEnum, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MealType } from '../../diet/entities/diet-record.entity';

class DishItemDto {
  @ApiProperty({ description: '菜品名称', example: '清蒸鸡胸肉' })
  @IsString()
  name: string;

  @ApiProperty({ description: '份量(g)', example: 150 })
  @IsNumber()
  quantityG: number;

  @ApiProperty({ description: '热量(kcal)', example: 165 })
  @IsNumber()
  calories: number;

  @ApiProperty({ description: '蛋白质(g)', example: 31, required: false })
  @IsNumber()
  @IsOptional()
  proteinG?: number;

  @ApiProperty({ description: '碳水(g)', example: 0, required: false })
  @IsNumber()
  @IsOptional()
  carbsG?: number;

  @ApiProperty({ description: '脂肪(g)', example: 3.5, required: false })
  @IsNumber()
  @IsOptional()
  fatG?: number;

  @ApiProperty({ description: '烹饪建议', example: '少盐蒸15分钟', required: false })
  @IsString()
  @IsOptional()
  cookingTip?: string;
}

class MealPlanDayDto {
  @ApiProperty({ description: '星期几(1-7)', example: 1 })
  @IsNumber()
  dayOfWeek: number;

  @ApiProperty({ description: '餐次类型', enum: MealType, example: 'breakfast' })
  @IsEnum(MealType)
  mealType: MealType;

  @ApiProperty({ description: '菜品列表', type: [DishItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DishItemDto)
  dishes: DishItemDto[];

  @ApiProperty({ description: '该餐总热量', example: 450 })
  @IsNumber()
  totalCalories: number;

  @ApiProperty({ description: '备注/烹饪建议', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateMealPlanDto {
  @ApiProperty({ description: '每日热量目标', example: 2000 })
  @IsNumber()
  calorieTarget: number;

  @ApiProperty({ description: '每日餐次数', example: 3 })
  @IsNumber()
  mealCount: number;

  @ApiProperty({ description: '健康目标', example: '减脂' })
  @IsString()
  healthGoal: string;

  @ApiProperty({ description: '口味偏好', example: ['清淡', '少油'] })
  @IsArray()
  @IsString({ each: true })
  flavorPrefs: string[];

  @ApiProperty({ description: '食谱明细', type: [MealPlanDayDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealPlanDayDto)
  @IsOptional()
  days?: MealPlanDayDto[];
}

export class GenerateMealPlanDto {
  @ApiProperty({ description: '每日热量目标', example: 2000 })
  @IsNumber()
  calorieTarget: number;

  @ApiProperty({ description: '每日餐次数', example: 3 })
  @IsNumber()
  mealCount: number;

  @ApiProperty({ description: '健康目标', example: '减脂' })
  @IsString()
  healthGoal: string;

  @ApiProperty({ description: '口味偏好', example: ['清淡', '少油'] })
  @IsArray()
  @IsString({ each: true })
  flavorPrefs: string[];

  @ApiProperty({ description: '身高(cm)', example: 175, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  heightCm?: number;

  @ApiProperty({ description: '体重(kg)', example: 65, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weightKg?: number;

  @ApiProperty({ description: '饮食限制/忌口', example: ['无麸质', '无海鲜'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  restrictions?: string[];

  @ApiProperty({ description: '自定义要求', example: '希望多安排鱼类，不喜欢胡萝卜', required: false })
  @IsString()
  @IsOptional()
  customRequest?: string;

  @ApiProperty({ description: '烹饪难度', enum: ['简单', '中等', '复杂'], required: false })
  @IsString()
  @IsOptional()
  cookingDifficulty?: string;
}

// 新增：更新食谱DTO
export class UpdateMealPlanDto {
  @ApiProperty({ description: '每日热量目标', example: 2000, required: false })
  @IsNumber()
  @IsOptional()
  calorieTarget?: number;

  @ApiProperty({ description: '每日餐次数', example: 3, required: false })
  @IsNumber()
  @IsOptional()
  mealCount?: number;

  @ApiProperty({ description: '健康目标', example: '减脂', required: false })
  @IsString()
  @IsOptional()
  healthGoal?: string;

  @ApiProperty({ description: '口味偏好', example: ['清淡', '少油'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  flavorPrefs?: string[];

  @ApiProperty({ description: '是否更新菜单（如果不传或false，则只更新设置）', example: true, required: false })
  @IsOptional()
  updateDays?: boolean;

  @ApiProperty({ description: '食谱明细（仅在updateDays为true时需要）', type: [MealPlanDayDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealPlanDayDto)
  @IsOptional()
  days?: MealPlanDayDto[];
}
