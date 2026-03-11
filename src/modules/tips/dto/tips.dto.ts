import { IsString, IsOptional, IsEnum, IsNumber, Length, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ColorTheme } from '../entities/user-tip.entity';

export class CreateTipDto {
  @ApiProperty({ description: '提示内容', example: '记得多喝水' })
  @IsString()
  @Length(1, 100)
  content: string;

  @ApiProperty({ description: '颜色主题', enum: ColorTheme, default: ColorTheme.GREEN, required: false })
  @IsEnum(ColorTheme)
  @IsOptional()
  colorTheme?: ColorTheme;

  @ApiProperty({ description: '展示权重(1-5)', example: 2, required: false })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  displayWeight?: number;

  @ApiProperty({ description: '排序', example: 0, required: false })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateTipDto {
  @ApiProperty({ description: '提示内容', required: false })
  @IsString()
  @Length(1, 100)
  @IsOptional()
  content?: string;

  @ApiProperty({ description: '颜色主题', enum: ColorTheme, required: false })
  @IsEnum(ColorTheme)
  @IsOptional()
  colorTheme?: ColorTheme;

  @ApiProperty({ description: '展示权重(1-5)', required: false })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  displayWeight?: number;

  @ApiProperty({ description: '是否启用', required: false })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: '排序', required: false })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
