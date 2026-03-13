import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MealPlanService } from './meal-plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMealPlanDto, GenerateMealPlanDto, UpdateMealPlanDto } from './dto/meal-plan.dto';

@ApiTags('食谱规划')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meal-plans')
export class MealPlanController {
  constructor(private readonly mealPlanService: MealPlanService) {}

  @Get('active')
  @ApiOperation({ summary: '获取当前激活的食谱' })
  async getActive(@CurrentUser('userId') userId: string) {
    return this.mealPlanService.getActive(userId);
  }

  @Get()
  @ApiOperation({ summary: '获取食谱历史列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getList(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.mealPlanService.getList(userId, page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取指定食谱详情' })
  async getById(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.mealPlanService.getById(userId, id);
  }

  @Post()
  @ApiOperation({ summary: '保存自定义食谱' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateMealPlanDto) {
    return this.mealPlanService.create(userId, dto);
  }

  @Post('generate')
  @ApiOperation({ summary: 'AI生成食谱' })
  async generate(@CurrentUser('userId') userId: string, @Body() dto: GenerateMealPlanDto) {
    return this.mealPlanService.generate(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新食谱（支持部分更新设置或菜单）' })
  async update(
    @CurrentUser('userId') userId: string, 
    @Param('id') id: string,
    @Body() dto: UpdateMealPlanDto,
  ) {
    return this.mealPlanService.update(userId, id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: '激活指定食谱' })
  async activate(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.mealPlanService.activate(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除食谱' })
  async delete(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.mealPlanService.delete(userId, id);
    return { message: '食谱已删除' };
  }
}
