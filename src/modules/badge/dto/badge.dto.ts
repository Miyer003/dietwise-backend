import { IsString, IsOptional, IsBoolean, IsInt, IsIn, Length, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBadgeDto {
  @ApiProperty({ description: '徽章编码', example: 'streak_7' })
  @IsString()
  @Length(1, 50)
  badgeCode: string;

  @ApiProperty({ description: '徽章名称', example: '连续7天' })
  @IsString()
  @Length(1, 100)
  badgeName: string;

  @ApiPropertyOptional({ description: '徽章描述', example: '坚持记录7天' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  badgeDesc?: string;

  @ApiPropertyOptional({ description: '图标Emoji', example: '🔥' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  iconEmoji?: string;

  @ApiPropertyOptional({ description: '图标颜色', example: '#F97316' })
  @IsOptional()
  @IsString()
  @Length(7, 7)
  iconColor?: string;

  @ApiProperty({ description: '分类', enum: ['continuous', 'balanced', 'habit'] })
  @IsString()
  @IsIn(['continuous', 'balanced', 'habit'])
  category: string;

  @ApiProperty({ description: '条件类型', example: 'streak_days' })
  @IsString()
  @Length(1, 30)
  conditionType: string;

  @ApiProperty({ description: '条件阈值', example: 7 })
  @IsInt()
  @Min(1)
  conditionValue: number;

  @ApiPropertyOptional({ description: '排序', example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateBadgeDto extends PartialType(CreateBadgeDto) {}

export class BadgeListQueryDto {
  @ApiPropertyOptional({ description: '分类筛选' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '状态筛选' })
  @IsOptional()
  @IsString()
  isActive?: string;

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

export class BadgeStatsDto {
  @ApiProperty({ description: '徽章编码' })
  badgeCode: string;

  @ApiProperty({ description: '徽章名称' })
  badgeName: string;

  @ApiProperty({ description: '总解锁人数' })
  totalUnlocked: number;

  @ApiProperty({ description: '本月解锁人数' })
  unlockedThisMonth: number;
}
