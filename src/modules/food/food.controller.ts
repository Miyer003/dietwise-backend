import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FoodService } from './food.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('食物库')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('foods')
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

  @Get()
  @ApiOperation({ summary: '获取食物列表（支持分类筛选）' })
  @ApiQuery({ name: 'category', description: '分类过滤', required: false })
  @ApiQuery({ name: 'limit', description: '数量限制', required: false })
  async getFoods(
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    return this.foodService.findByCategory(category, limit || 50);
  }

  @Get('search')
  @ApiOperation({ summary: '搜索食物（支持中文+拼音模糊搜索）' })
  @ApiQuery({ name: 'q', description: '关键词', required: true })
  @ApiQuery({ name: 'category', description: '分类过滤', required: false })
  @ApiQuery({ name: 'limit', description: '数量限制', required: false })
  async search(
    @Query('q') keyword: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    return this.foodService.search(keyword, category, limit || 20);
  }

  @Get('categories')
  @ApiOperation({ summary: '获取所有分类' })
  async getCategories() {
    return this.foodService.getCategories();
  }

  @Get('recent')
  @ApiOperation({ summary: '获取最近常吃的食物Top10' })
  @ApiQuery({ name: 'limit', description: '返回数量限制', required: false })
  async getRecent(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.foodService.getRecent(userId, limit || 10);
  }

  @Get('semantic/search')
  @ApiOperation({ summary: '语义搜索（RAG）' })
  @ApiQuery({ name: 'q', description: '查询文本', required: true })
  async semanticSearch(@Query('q') query: string) {
    return this.foodService.semanticSearch(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取食物详情' })
  async getById(@Param('id') id: string) {
    return this.foodService.findById(id);
  }
}
