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
  heightCm?: number;

  @ApiProperty({ description: '体重(kg)', example: 65, required: false })
  @IsNumber()
  @IsOptional()
  weightKg?: number;
}
