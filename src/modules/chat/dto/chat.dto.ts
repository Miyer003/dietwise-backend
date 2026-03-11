import { IsString, IsOptional, IsBoolean, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ description: '会话标题', example: '减脂饮食咨询', required: false })
  @IsString()
  @Length(1, 100)
  @IsOptional()
  title?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: '消息内容', example: '我今天已经吃了这么多，晚餐应该吃什么？' })
  @IsString()
  @Length(1, 2000)
  message: string;

  @ApiProperty({ description: '是否包含今日饮食上下文', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  includeContext?: boolean;
}

export class QuickQuestionDto {
  @ApiProperty({ description: '快捷问题类型', example: 'today_remaining' })
  @IsString()
  type: string;
}
