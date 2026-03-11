import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../../user/entities/user.entity';

export class UpdateUserStatusDto {
  @ApiProperty({ description: '用户状态', enum: UserStatus, example: 'active' })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiProperty({ description: '操作原因', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ImportFoodLibraryDto {
  @ApiProperty({ description: '数据源URL或文件内容' })
  @IsString()
  data: string;
}
