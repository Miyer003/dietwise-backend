import { Controller, Post, Get, Body, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AIService } from '../../shared/ai/ai.service';
import { DietService } from '../diet/diet.service';
import { TipsService } from '../tips/tips.service';
import { UserService } from '../user/user.service';
import { AnalyzeNutritionDto, GenerateTipDto } from './dto/ai.dto';

@ApiTags('AI服务')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly dietService: DietService,
    private readonly tipsService: TipsService,
    private readonly userService: UserService,
  ) {}

  @Post('analyze-nutrition')
  @ApiOperation({ summary: 'AI营养分析（图片/文字）' })
  async analyzeNutrition(@Body() dto: AnalyzeNutritionDto) {
    if (dto.type === 'image' && dto.imageUrl) {
      const result = await this.aiService.analyzeNutrition(dto.imageUrl);
      return {
        ...result,
        isCached: false,
      };
    }

    // 文字描述分析
    if (!dto.description) {
      return { error: '请提供食物描述' };
    }
    return this.aiService.analyzeNutritionByText(dto.description, dto.quantityG);
  }

  @Post('generate-tip')
  @ApiOperation({ summary: '生成今日AI健康建议' })
  async generateTip(@CurrentUser('userId') userId: string, @Body() dto: GenerateTipDto) {
    // 检查用户是否有自定义提示
    const hasCustomTips = await this.tipsService.hasCustomTips(userId);
    
    if (hasCustomTips && !dto.forceAI) {
      // 返回用户的自定义提示
      const randomTip = await this.tipsService.getRandom(userId);
      if (randomTip) {
        return {
          type: 'custom',
          content: randomTip.content,
          colorTheme: randomTip.colorTheme,
          id: randomTip.id,
        };
      }
    }

    // 生成AI建议
    const today = new Date().toISOString().split('T')[0];
    const summary = await this.dietService.getDailySummary(userId, today);
    const profile = await this.userService.getProfile(userId).catch(() => null);

    const prompt = this.buildTipPrompt(summary, profile);
    const aiResponse = await this.aiService.chat([
      { role: 'user', content: prompt },
    ]);

    return {
      type: 'ai',
      content: aiResponse,
    };
  }

  @Get('usage/me')
  @ApiOperation({ summary: '查询本月AI调用量与费用' })
  async getUsage(@CurrentUser('userId') userId: string) {
    // TODO: 从ai_call_logs统计
    return {
      month: new Date().toISOString().slice(0, 7),
      callCount: 0,
      estimatedCost: 0,
    };
  }

  private buildTipPrompt(summary: any, profile: any): string {
    return `作为营养师，请根据用户今日的饮食数据，生成一条简洁、个性化的健康建议（50-100字）。

今日摄入情况：
- 热量目标：${summary.calorieGoal} kcal
- 已摄入：${summary.calorieConsumed} kcal
- 剩余：${summary.calorieRemaining} kcal
- 已记录餐次：${summary.mealRecords?.length || 0} 餐

建议要求：
1. 简洁有力，易于执行
2. 结合今日数据给出具体建议
3. 鼓励性语气`;
  }
}
