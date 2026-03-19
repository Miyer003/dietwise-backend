import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum AnalyzeType {
  IMAGE = 'image',
  TEXT = 'text',
}

export class AnalyzeNutritionDto {
  @ApiProperty({ description: '分析类型', enum: AnalyzeType, example: 'image' })
  @IsEnum(AnalyzeType)
  type: AnalyzeType;

  @ApiProperty({ description: '图片URL（拍照识别时，与 imageBase64 二选一）', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: '图片 Base64 数据（拍照识别时，与 imageUrl 二选一）', required: false })
  @IsString()
  @IsOptional()
  imageBase64?: string;

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

export class GenerateMealPlanDto {
  @ApiProperty({ description: '每日热量目标(kcal)', example: 2000, required: false })
  @IsNumber()
  @IsOptional()
  calorieTarget?: number;

  @ApiProperty({ description: '每日餐数', example: 3, required: false })
  @IsNumber()
  @IsOptional()
  mealCount?: number;

  @ApiProperty({ description: '健康目标', enum: ['减脂', '增肌', '维持'], required: false })
  @IsString()
  @IsOptional()
  healthGoal?: string;

  @ApiProperty({ description: '口味偏好', type: [String], example: ['清淡'] })
  @IsArray()
  @IsString({ each: true })
  flavorPrefs: string[];

  @ApiProperty({ description: '身高(cm)', required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  heightCm?: number;

  @ApiProperty({ description: '体重(kg)', required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weightKg?: number;

  @ApiProperty({ description: '使用AI生成', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  useAI?: boolean;
}

export class ChatDto {
  @ApiProperty({ description: '会话ID（新会话不传）', required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ description: '用户消息' })
  @IsString()
  message: string;

  @ApiProperty({ description: '是否包含上下文（饮食数据）', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  includeContext?: boolean;
}

export class AnalyzeVoiceDto {
  @ApiProperty({ description: '音频文件 Base64 数据', required: true })
  @IsString()
  audioBase64: string;

  @ApiProperty({ description: '音频 MIME 类型', example: 'audio/wav', required: false })
  @IsString()
  @IsOptional()
  mimeType?: string;
}
