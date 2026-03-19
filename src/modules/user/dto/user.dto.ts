import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsArray, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../entities/user-profile.entity';

export class UpdateUserDto {
  @ApiProperty({ description: '昵称', example: '健康达人', required: false })
  @IsString()
  @Length(1, 50)
  @IsOptional()
  nickname?: string;

  @ApiProperty({ description: '头像Emoji', example: '🥗', required: false })
  @IsString()
  @Length(1, 10)
  @IsOptional()
  avatarEmoji?: string;

  @ApiProperty({ description: '头像URL', example: 'https://minio.example.com/avatars/xxx.jpg', required: false })
  @IsString()
  @Length(0, 255)
  @IsOptional()
  avatarUrl?: string;
}

export class UpdateUserProfileDto {
  @ApiProperty({ description: '性别', enum: Gender, example: 'male', required: false })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiProperty({ description: '出生日期', example: '1999-01-01', required: false })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiProperty({ description: '身高(cm)', example: 175.0, required: false })
  @IsNumber()
  @IsOptional()
  heightCm?: number;

  @ApiProperty({ description: '体重(kg)', example: 65.0, required: false })
  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @ApiProperty({ description: '目标体重(kg)', example: 60.0, required: false })
  @IsNumber()
  @IsOptional()
  targetWeightKg?: number;

  @ApiProperty({ description: '健康目标', example: '减脂', required: false })
  @IsString()
  @IsOptional()
  healthGoal?: string;

  @ApiProperty({ description: '活动水平', example: 'moderately', required: false })
  @IsString()
  @IsOptional()
  activityLevel?: string;

  @ApiProperty({ description: '每日热量目标(kcal)', example: 2000, required: false })
  @IsNumber()
  @IsOptional()
  dailyCalorieGoal?: number;

  @ApiProperty({ description: '每日餐次数', example: 3, required: false })
  @IsNumber()
  @IsOptional()
  mealCount?: number;

  @ApiProperty({ description: '饮食标签', example: ['清淡', '低糖'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dietTags?: string[];

  @ApiProperty({ description: '过敏原', example: ['花生'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergyTags?: string[];

  @ApiProperty({ description: '口味偏好', example: ['微辣'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  flavorPrefs?: string[];

  @ApiProperty({ description: '个性签名', example: '健康生活每一天', required: false })
  @IsString()
  @Length(0, 200)
  @IsOptional()
  bio?: string;
}
