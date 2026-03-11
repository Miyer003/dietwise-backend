import { IsString, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFoodDto {
  @ApiProperty({ description: '食物名称', example: '米饭' })
  @IsString()
  name: string;

  @ApiProperty({ description: '拼音', example: 'mifan', required: false })
  @IsString()
  @IsOptional()
  namePinyin?: string;

  @ApiProperty({ description: '别名', example: ['白米饭'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  nameAliases?: string[];

  @ApiProperty({ description: '分类', example: '主食' })
  @IsString()
  category: string;

  @ApiProperty({ description: '每100g热量(kcal)', example: 116 })
  @IsNumber()
  caloriesPer100g: number;

  @ApiProperty({ description: '每100g蛋白质(g)', example: 2.6 })
  @IsNumber()
  proteinPer100g: number;

  @ApiProperty({ description: '每100g碳水(g)', example: 25.9 })
  @IsNumber()
  carbsPer100g: number;

  @ApiProperty({ description: '每100g脂肪(g)', example: 0.3 })
  @IsNumber()
  fatPer100g: number;

  @ApiProperty({ description: '每100g膳食纤维(g)', example: 0.3, required: false })
  @IsNumber()
  @IsOptional()
  fiberPer100g?: number;

  @ApiProperty({ description: '每100g钠(mg)', example: 2, required: false })
  @IsNumber()
  @IsOptional()
  sodiumPer100g?: number;

  @ApiProperty({ description: '默认份量(g)', example: 150, required: false })
  @IsNumber()
  @IsOptional()
  defaultPortionG?: number;

  @ApiProperty({ description: '数据来源', example: 'china_cdk', required: false })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({ description: '是否已核验', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;
}
