import { IsString, IsOptional, IsEnum, IsArray, IsNumber, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MealType, InputMethod } from '../entities/diet-record.entity';

class DietRecordItemDto {
  @ApiProperty({ description: '食物名称', example: '红烧肉' })
  @IsString()
  foodName: string;

  @ApiProperty({ description: '食物项ID（手动录入时）', required: false })
  @IsString()
  @IsOptional()
  foodItemId?: string;

  @ApiProperty({ description: '摄入量(g)', example: 150 })
  @IsNumber()
  quantityG: number;

  @ApiProperty({ description: '份量系数', example: 1.0, required: false })
  @IsNumber()
  @IsOptional()
  portionFactor?: number;

  @ApiProperty({ description: '热量(kcal)', example: 450 })
  @IsNumber()
  calories: number;

  @ApiProperty({ description: '蛋白质(g)', example: 15 })
  @IsNumber()
  proteinG: number;

  @ApiProperty({ description: '碳水(g)', example: 20 })
  @IsNumber()
  carbsG: number;

  @ApiProperty({ description: '脂肪(g)', example: 35 })
  @IsNumber()
  fatG: number;

  @ApiProperty({ description: '膳食纤维(g)', example: 0, required: false })
  @IsNumber()
  @IsOptional()
  fiberG?: number;

  @ApiProperty({ description: '钠(mg)', example: 800, required: false })
  @IsNumber()
  @IsOptional()
  sodiumMg?: number;
}

export class CreateDietRecordDto {
  @ApiProperty({ description: '记录日期', example: '2025-01-15' })
  @IsDateString()
  recordDate: string;

  @ApiProperty({ description: '餐次类型', enum: MealType, example: 'lunch' })
  @IsEnum(MealType)
  mealType: MealType;

  @ApiProperty({ description: '录入方式', enum: InputMethod, example: 'photo' })
  @IsEnum(InputMethod)
  inputMethod: InputMethod;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: '图片URL（拍照识别时）', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: '图片哈希（用于缓存）', required: false })
  @IsString()
  @IsOptional()
  imageHash?: string;

  @ApiProperty({ description: '份量系数（拍照识别时调整）', example: 1.0, required: false })
  @IsNumber()
  @IsOptional()
  portionFactor?: number;

  @ApiProperty({ description: '食物明细（手动/语音录入时）', type: [DietRecordItemDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DietRecordItemDto)
  items: DietRecordItemDto[];
}

export class UpdateDietRecordDto {
  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: '份量系数', example: 1.0, required: false })
  @IsNumber()
  @IsOptional()
  portionFactor?: number;

  @ApiProperty({ description: '食物明细', type: [DietRecordItemDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DietRecordItemDto)
  @IsOptional()
  items?: DietRecordItemDto[];
}
