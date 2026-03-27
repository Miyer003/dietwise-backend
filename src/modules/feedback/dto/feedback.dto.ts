import { IsString, IsOptional, IsEnum, IsArray, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeedbackType, FeedbackStatus } from '../entities/feedback.entity';

export class CreateFeedbackDto {
  @ApiProperty({ description: '反馈类型', enum: FeedbackType, example: 'bug' })
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @ApiProperty({ description: '反馈内容', example: '发现拍照识别不准确' })
  @IsString()
  content: string;

  @ApiProperty({ description: '联系方式', example: 'user@example.com', required: false })
  @IsString()
  @IsOptional()
  contactInfo?: string;

  @ApiProperty({ description: '截图URL数组', example: ['url1', 'url2'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  screenshots?: string[];
}

export class UpdateFeedbackStatusDto {
  @ApiProperty({ description: '新状态', enum: FeedbackStatus, example: 'resolved' })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;

  @ApiProperty({ description: '管理员回复', required: false })
  @IsString()
  @IsOptional()
  adminReply?: string;
}
