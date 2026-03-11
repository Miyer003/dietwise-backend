import { Controller, Get, Patch, Put, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto, UpdateUserProfileDto } from './dto/user.dto';

@ApiTags('用户')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
}
