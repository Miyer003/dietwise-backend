import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushSyncDto } from './dto/sync.dto';

@ApiTags('数据同步')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @ApiOperation({ summary: '推送离线记录到云端' })
  async push(
    @CurrentUser('userId') userId: string,
    @Body() dto: PushSyncDto,
  ) {
    return this.syncService.push(userId, dto);
  }

  @Get('pull')
  @ApiOperation({ summary: '拉取云端最新数据' })
  @ApiQuery({ name: 'lastSyncAt', required: true })
  @ApiQuery({ name: 'deviceId', required: true })
  async pull(
    @CurrentUser('userId') userId: string,
    @Query('lastSyncAt') lastSyncAt: string,
    @Query('deviceId') deviceId: string,
  ) {
    return this.syncService.pull(userId, lastSyncAt, deviceId);
  }
}
