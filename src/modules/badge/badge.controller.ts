import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BadgeService } from './badge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateBadgeDto, UpdateBadgeDto, BadgeListQueryDto } from './dto/badge.dto';

@ApiTags('成就徽章管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/badges')
export class BadgeController {
  constructor(private readonly badgeService: BadgeService) {}

  @Get()
  @ApiOperation({ summary: '徽章列表' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query() query: BadgeListQueryDto) {
    return this.badgeService.findAll(query);
  }

  @Get('all')
  @ApiOperation({ summary: '所有启用徽章（不分页）' })
  async findAllActive() {
    return this.badgeService.findAllActive();
  }

  @Get('stats')
  @ApiOperation({ summary: '徽章获得统计' })
  async getStats() {
    return this.badgeService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: '徽章详情' })
  async findOne(@Param('id') id: string) {
    return this.badgeService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建徽章' })
  async create(@Body() dto: CreateBadgeDto) {
    return this.badgeService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新徽章' })
  async update(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
    return this.badgeService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除徽章' })
  async remove(@Param('id') id: string) {
    await this.badgeService.remove(id);
    return { message: '删除成功' };
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: '启用/禁用徽章' })
  async toggleStatus(@Param('id') id: string) {
    return this.badgeService.toggleStatus(id);
  }
}
