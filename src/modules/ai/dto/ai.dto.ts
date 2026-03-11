import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AnalyzeType {
  IMAGE = 'image',
  TEXT = 'text',
}

export class AnalyzeNutritionDto {
  @ApiProperty({ description: '分析类型', enum: AnalyzeType, example: 'image' })
  @IsEnum(AnalyzeType)
  type: AnalyzeType;

  @ApiProperty({ description: '图片URL（拍照识别时）', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: '图片哈希（用于缓存）', required: false })
  @IsString()
  @IsOptional()
  imageHash?: string;

  @ApiProperty({ description: '食物描述（文字识别时）', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '份量估算(g)', example: 150, required: false })
  @IsNumber()
  @IsOptional()
  quantityG?: number;
}

export class GenerateTipDto {
  @ApiProperty({ description: '强制使用AI生成（忽略自定义提示）', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  forceAI?: boolean;
}
