import { Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AchievementService } from './achievement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('成就徽章')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  @ApiOperation({ summary: '获取成就徽章列表' })
  async getAll(@CurrentUser('userId') userId: string) {
    return this.achievementService.getAll(userId);
  }

  @Get('new')
  @ApiOperation({ summary: '获取新解锁成就（首页气泡）' })
  async getNew(@CurrentUser('userId') userId: string) {
    return this.achievementService.getNew(userId);
  }

  @Patch('read')
  @ApiOperation({ summary: '标记成就为已读' })
  async markAsRead(@CurrentUser('userId') userId: string) {
    await this.achievementService.markAsRead(userId);
    return { message: '已标记为已读' };
  }
}
