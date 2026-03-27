import { IsEnum, IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../user/entities/user.entity';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, description: '用户状态' })
  @IsEnum(UserStatus)
  status: UserStatus;
}

export class UserListQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词（手机号/昵称）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '状态筛选', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}

export class DashboardOverviewDto {
  @ApiProperty({ description: '总用户数' })
  totalUsers: number;

  @ApiProperty({ description: '今日活跃用户数' })
  todayActiveUsers: number;

  @ApiProperty({ description: '今日新增用户数' })
  todayNewUsers: number;

  @ApiProperty({ description: '今日饮食记录数' })
  todayRecords: number;

  @ApiProperty({ description: '今日AI调用次数' })
  todayAICalls: number;

  @ApiProperty({ description: '今日AI调用费用(元)' })
  todayAICost: number;

  @ApiProperty({ description: '待处理反馈数' })
  pendingFeedbacks: number;
}

export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: '开始日期', example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期', example: '2026-03-25' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ description: '处理回复' })
  @IsOptional()
  @IsString()
  adminReply?: string;

  @ApiPropertyOptional({ description: '状态', enum: ['pending', 'processing', 'resolved', 'rejected'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateFoodDto {
  @ApiProperty({ description: '食物名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '拼音' })
  @IsOptional()
  @IsString()
  namePinyin?: string;

  @ApiProperty({ description: '分类' })
  @IsString()
  category: string;

  @ApiProperty({ description: '热量(每100g)' })
  caloriesPer100g: number;

  @ApiProperty({ description: '蛋白质(每100g)' })
  proteinPer100g: number;

  @ApiProperty({ description: '碳水(每100g)' })
  carbsPer100g: number;

  @ApiProperty({ description: '脂肪(每100g)' })
  fatPer100g: number;

  @ApiPropertyOptional({ description: '膳食纤维(每100g)' })
  @IsOptional()
  fiberPer100g?: number;

  @ApiPropertyOptional({ description: '钠(每100g)' })
  @IsOptional()
  sodiumPer100g?: number;

  @ApiPropertyOptional({ description: '默认份量(g)' })
  @IsOptional()
  defaultPortionG?: number;
}
