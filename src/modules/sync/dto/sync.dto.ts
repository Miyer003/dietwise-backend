import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateDietRecordDto } from '../../diet/dto/create-diet-record.dto';

export class PushSyncDto {
  @ApiProperty({ description: '设备ID' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: '离线饮食记录', type: [CreateDietRecordDto], required: false })
  @IsArray()
  @IsOptional()
  records?: CreateDietRecordDto[];

  @ApiProperty({ description: '自定义提示', required: false })
  @IsArray()
  @IsOptional()
  tips?: any[];

  @ApiProperty({ description: '提醒设置', required: false })
  @IsOptional()
  notificationSettings?: any;
}

export class PullSyncResponseDto {
  @ApiProperty({ description: '饮食记录' })
  dietRecords: any[];

  @ApiProperty({ description: '食谱' })
  mealPlans: any[];

  @ApiProperty({ description: '用户画像' })
  userProfile: any;

  @ApiProperty({ description: '提醒设置' })
  notificationSettings: any;

  @ApiProperty({ description: '成就徽章' })
  achievements: any[];

  @ApiProperty({ description: '服务器时间' })
  serverTime: string;
}
