import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TipsService } from './tips.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTipDto, UpdateTipDto } from './dto/tips.dto';

@ApiTags('自定义提示')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tips')
export class TipsController {
  constructor(private readonly tipsService: TipsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有自定义提示' })
  async getAll(@CurrentUser('userId') userId: string) {
    return this.tipsService.getAll(userId);
  }

  @Get('random')
  @ApiOperation({ summary: '加权随机获取一条提示（首页刷新）' })
  async getRandom(@CurrentUser('userId') userId: string) {
    return this.tipsService.getRandom(userId);
  }

  @Post()
  @ApiOperation({ summary: '创建提示' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateTipDto) {
    return this.tipsService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新提示' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTipDto,
  ) {
    return this.tipsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除提示' })
  async delete(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.tipsService.delete(userId, id);
    return { message: '提示已删除' };
  }
}
