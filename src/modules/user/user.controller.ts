import { Controller, Get, Patch, Put, Delete, Body, Query, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AchievementService } from '../achievement/achievement.service';
import { MinioService } from '../../shared/minio/minio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto, UpdateUserProfileDto } from './dto/user.dto';

@ApiTags('用户')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly achievementService: AchievementService,
    private readonly minioService: MinioService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getMe(@CurrentUser('userId') userId: string) {
    return this.userService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新用户信息（部分更新）' })
  async updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(userId, dto);
  }

  @Get('me/profile')
  @ApiOperation({ summary: '获取用户画像' })
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put('me/profile')
  @ApiOperation({ summary: '全量更新用户画像' })
  async updateProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: '部分更新用户画像' })
  async patchProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: '获取用户统计数据' })
  async getStats(@CurrentUser('userId') userId: string) {
    return this.userService.getStats(userId);
  }

  @Delete('me')
  @ApiOperation({ summary: '注销账号' })
  async deleteAccount(@CurrentUser('userId') userId: string) {
    await this.userService.delete(userId);
    return { message: '账号已注销' };
  }

  @Get('me/achievements')
  @ApiOperation({ summary: '获取成就徽章列表' })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'new'] })
  async getAchievements(
    @CurrentUser('userId') userId: string,
    @Query('status') status?: string,
  ) {
    if (status === 'new') {
      return this.achievementService.getNew(userId);
    }
    return this.achievementService.getAll(userId);
  }

  @Get('me/achievements/progress')
  @ApiOperation({ summary: '获取成就徽章进度' })
  async getAchievementsProgress(@CurrentUser('userId') userId: string) {
    return this.achievementService.getProgress(userId);
  }

  @Get('me/achievements/new')
  @ApiOperation({ summary: '获取新解锁成就' })
  async getNewAchievements(@CurrentUser('userId') userId: string) {
    return this.achievementService.getNew(userId);
  }

  @Patch('me/achievements/read')
  @ApiOperation({ summary: '标记成就为已读' })
  async markAchievementsRead(@CurrentUser('userId') userId: string) {
    await this.achievementService.markAsRead(userId);
    return { message: '已标记为已读' };
  }

  @Post('me/avatar/upload-url')
  @ApiOperation({ summary: '获取头像上传预签名URL' })
  async getAvatarUploadUrl(
    @CurrentUser('userId') userId: string,
    @Query('filename') filename: string,
  ) {
    const objectName = `avatars/${userId}/${Date.now()}_${filename}`;
    const uploadUrl = await this.minioService.getPresignedPutUrl(objectName, 600);
    const avatarUrl = this.minioService.getPublicUrl(objectName);
    
    return { 
      uploadUrl, 
      objectName,
      avatarUrl, // 上传成功后这个 URL 可以直接使用
    };
  }
}
