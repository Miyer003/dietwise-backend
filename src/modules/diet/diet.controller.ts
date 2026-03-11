import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DietService } from './diet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDietRecordDto, UpdateDietRecordDto } from './dto/create-diet-record.dto';
import { MinioService } from '../../shared/minio/minio.service';

@ApiTags('饮食记录')
@ApiBearerAuth()
@Controller('diet')
export class DietController {
  constructor(
    private readonly dietService: DietService,
    private readonly minioService: MinioService,
  ) {}

  @Get('records')
  @ApiOperation({ summary: '查询记录列表' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'mealType', required: false })
  async getRecords(
    @CurrentUser('userId') userId: string,
    @Query('date') date?: string,
    @Query('mealType') mealType?: string,
  ) {
    return this.dietService.getRecords(userId, date || '', mealType);
  }

  @Get('records/:id')
  @ApiOperation({ summary: '获取单条记录详情' })
  async getRecord(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.dietService.getRecordById(userId, id);
  }

  @Post('records')
  @ApiOperation({ summary: '创建记录' })
  async createRecord(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateDietRecordDto,
  ) {
    return this.dietService.createRecord(userId, dto);
  }

  @Patch('records/:id')
  @ApiOperation({ summary: '更新记录' })
  async updateRecord(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDietRecordDto,
  ) {
    return this.dietService.updateRecord(userId, id, dto);
  }

  @Delete('records/:id')
  @ApiOperation({ summary: '删除记录' })
  async deleteRecord(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.dietService.deleteRecord(userId, id);
    return { message: '记录已删除' };
  }

  @Get('summary/daily')
  @ApiOperation({ summary: '指定日期营养摘要' })
  @ApiQuery({ name: 'date', required: true })
  async getDailySummary(
    @CurrentUser('userId') userId: string,
    @Query('date') date: string,
  ) {
    return this.dietService.getDailySummary(userId, date);
  }

  @Get('summary/weekly')
  @ApiOperation({ summary: '周营养摘要' })
  @ApiQuery({ name: 'weekStart', required: true })
  async getWeeklySummary(
    @CurrentUser('userId') userId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.dietService.getWeeklySummary(userId, weekStart);
  }

  @Get('summary/monthly')
  @ApiOperation({ summary: '月营养摘要' })
  @ApiQuery({ name: 'month', required: true, example: '2025-01' })
  async getMonthlySummary(
    @CurrentUser('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.dietService.getMonthlySummary(userId, month);
  }

  @Post('upload-image')
  @ApiOperation({ summary: '获取图片上传URL（预签名）' })
  async getUploadUrl(
    @CurrentUser('userId') userId: string,
    @Query('filename') filename: string,
  ) {
    const objectName = `diet/${userId}/${Date.now()}_${filename}`;
    const url = await this.minioService.getPresignedPutUrl(objectName, 600);
    return { uploadUrl: url, objectName };
  }
}
