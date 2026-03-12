import { Controller, Get, Put, Patch, Body, UseGuards, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateNotificationSettingsDto, PushTokenDto } from './dto/notification.dto';

@ApiTags('提醒设置')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('settings')
  @ApiOperation({ summary: '获取提醒设置' })
  async getSettings(@CurrentUser('userId') userId: string) {
    return this.notificationService.getSettings(userId);
  }

  @Put('settings')
  @ApiOperation({ summary: '全量更新提醒设置' })
  async updateSettings(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationService.updateSettings(userId, dto);
  }

  @Patch('settings')
  @ApiOperation({ summary: '部分更新提醒设置' })
  async patchSettings(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationService.updateSettings(userId, dto);
  }

  @Post('push-token')
  @ApiOperation({ summary: '注册Expo Push Token' })
  async registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body() dto: PushTokenDto,
  ) {
    await this.notificationService.savePushToken(userId, dto.expoPushToken);
    return { message: 'Token已注册' };
  }
}
