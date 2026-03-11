import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';

@ApiTags('用户反馈')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: '提交反馈' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: '查看我的反馈列表' })
  async getMyList(@CurrentUser('userId') userId: string) {
    return this.feedbackService.getByUser(userId);
  }

  // 管理员接口
  @Get('admin/feedbacks')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理端：反馈列表' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAdminList(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.feedbackService.getList(status, page || 1, limit || 20);
  }

  @Get('admin/feedbacks/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理端：反馈详情' })
  async getAdminDetail(@Param('id') id: string) {
    return this.feedbackService.getById(id);
  }

  @Patch('admin/feedbacks/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理端：处理反馈' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackStatusDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.feedbackService.updateStatus(id, dto, adminId);
  }
}
