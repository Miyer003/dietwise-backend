import { Controller, Get, Post, Put, Delete, Patch, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { UpdateUserStatusDto, UserListQueryDto, DateRangeQueryDto, UpdateFeedbackDto } from './dto/admin.dto';
import { FeedbackStatus } from '../feedback/entities/feedback.entity';

@ApiTags('管理后台')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== Dashboard ====================

  @Get('dashboard/overview')
  @ApiOperation({ summary: '数据看板 - 核心指标概览' })
  async getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('dashboard/user-growth')
  @ApiOperation({ summary: '数据看板 - 用户增长趋势' })
  @ApiQuery({ name: 'days', required: false, description: '天数，默认30' })
  async getUserGrowthTrend(@Query('days') days?: number) {
    return this.adminService.getUserGrowthTrend(days || 30);
  }

  @Get('dashboard/ai-usage')
  @ApiOperation({ summary: '数据看板 - AI使用趋势' })
  @ApiQuery({ name: 'days', required: false, description: '天数，默认30' })
  async getAIUsageTrend(@Query('days') days?: number) {
    return this.adminService.getAIUsageTrend(days || 30);
  }

  // ==================== 用户管理 ====================

  @Get('users')
  @ApiOperation({ summary: '用户列表' })
  async getUsers(@Query() query: UserListQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: '用户详情' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Get('users/:id/records')
  @ApiOperation({ summary: '用户饮食记录' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getUserRecords(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getUserRecords(id, page || 1, limit || 20);
  }

  @Get('users/:id/achievements')
  @ApiOperation({ summary: '用户成就' })
  async getUserAchievements(@Param('id') id: string) {
    return this.adminService.getUserAchievements(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: '修改用户状态' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto);
  }

  // ==================== 食物库管理 ====================

  @Get('foods')
  @ApiOperation({ summary: '食物列表' })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getFoods(
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getFoods(keyword, category, page || 1, limit || 20);
  }

  @Get('foods/categories')
  @ApiOperation({ summary: '食物分类' })
  async getFoodCategories() {
    return this.adminService.getFoodCategories();
  }

  @Get('foods/:id')
  @ApiOperation({ summary: '食物详情' })
  async getFoodDetail(@Param('id') id: string) {
    return this.adminService.getFoodDetail(id);
  }

  @Post('foods')
  @ApiOperation({ summary: '创建食物' })
  async createFood(@Body() data: any) {
    return this.adminService.createFood(data);
  }

  @Put('foods/:id')
  @ApiOperation({ summary: '更新食物' })
  async updateFood(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateFood(id, data);
  }

  @Delete('foods/:id')
  @ApiOperation({ summary: '删除食物' })
  async deleteFood(@Param('id') id: string) {
    await this.adminService.deleteFood(id);
    return { message: '删除成功' };
  }

  // ==================== AI监控 ====================

  @Get('ai-monitor/stats')
  @ApiOperation({ summary: 'AI统计概览' })
  async getAIStats(@Query() query: DateRangeQueryDto) {
    return this.adminService.getAIStats(query);
  }

  @Get('ai-monitor/providers')
  @ApiOperation({ summary: '按服务商统计' })
  async getAIStatsByProvider(@Query() query: DateRangeQueryDto) {
    return this.adminService.getAIStatsByProvider(query);
  }

  @Get('ai-monitor/functions')
  @ApiOperation({ summary: '按功能统计' })
  async getAIStatsByFunction(@Query() query: DateRangeQueryDto) {
    return this.adminService.getAIStatsByFunction(query);
  }

  @Get('ai-monitor/logs')
  @ApiOperation({ summary: 'AI调用日志' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAILogs(
    @Query() query: DateRangeQueryDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAILogs({ ...query, page: page || 1, limit: limit || 20 });
  }

  // ==================== 反馈管理 ====================

  @Get('feedbacks')
  @ApiOperation({ summary: '反馈列表' })
  @ApiQuery({ name: 'status', required: false, enum: FeedbackStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getFeedbacks(
    @Query('status') status?: FeedbackStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getFeedbacks(status, page || 1, limit || 20);
  }

  @Get('feedbacks/:id')
  @ApiOperation({ summary: '反馈详情' })
  async getFeedbackDetail(@Param('id') id: string) {
    return this.adminService.getFeedbackDetail(id);
  }

  @Patch('feedbacks/:id')
  @ApiOperation({ summary: '处理反馈' })
  async updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.adminService.updateFeedback(id, dto);
  }
}
