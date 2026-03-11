import { IsString, IsOptional, IsBoolean, IsNumber, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  @ApiProperty({ description: '总开关', required: false })
  @IsBoolean()
  @IsOptional()
  masterEnabled?: boolean;

  // 早餐
  @ApiProperty({ description: '早餐提醒开关', required: false })
  @IsBoolean()
  @IsOptional()
  breakfastEnabled?: boolean;

  @ApiProperty({ description: '早餐提醒时间', example: '07:30', required: false })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: '时间格式不正确，应为HH:MM' })
  @IsOptional()
  breakfastTime?: string;

  // 午餐
  @ApiProperty({ description: '午餐提醒开关', required: false })
  @IsBoolean()
  @IsOptional()
  lunchEnabled?: boolean;

  @ApiProperty({ description: '午餐提醒时间', example: '12:00', required: false })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: '时间格式不正确' })
  @IsOptional()
  lunchTime?: string;

  // 晚餐
  @ApiProperty({ description: '晚餐提醒开关', required: false })
  @IsBoolean()
  @IsOptional()
  dinnerEnabled?: boolean;

  @ApiProperty({ description: '晚餐提醒时间', example: '18:00', required: false })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: '时间格式不正确' })
  @IsOptional()
  dinnerTime?: string;

  // 饮水
  @ApiProperty({ description: '饮水提醒开关', required: false })
  @IsBoolean()
  @IsOptional()
  waterEnabled?: boolean;

  @ApiProperty({ description: '饮水间隔(小时)', example: 2, required: false })
  @IsNumber()
  @IsOptional()
  waterIntervalH?: number;

  @ApiProperty({ description: '饮水开始时间', example: '08:00', required: false })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  waterStartTime?: string;

  @ApiProperty({ description: '饮水结束时间', example: '22:00', required: false })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  waterEndTime?: string;

  // 其他
  @ApiProperty({ description: '记录提醒开关', required: false })
  @IsBoolean()
  @IsOptional()
  recordRemind?: boolean;

  @ApiProperty({ description: '睡前提醒开关', required: false })
  @IsBoolean()
  @IsOptional()
  bedtimeRemind?: boolean;

  @ApiProperty({ description: '睡前提醒时间', example: '21:30', required: false })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  bedtimeTime?: string;
}

export class PushTokenDto {
  @ApiProperty({ description: 'Expo Push Token' })
  @IsString()
  token: string;
}
