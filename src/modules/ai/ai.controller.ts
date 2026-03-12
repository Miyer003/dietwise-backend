import { Controller, Post, Get, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AIService } from '../../shared/ai/ai.service';
import { DietService } from '../diet/diet.service';
import { TipsService } from '../tips/tips.service';
import { UserService } from '../user/user.service';
import { MealPlanService } from '../meal-plan/meal-plan.service';
import { ChatService } from '../chat/chat.service';
import { AILogService, AIFunctionType, AIProvider } from './ai-log.service';
import { AnalyzeNutritionDto, GenerateTipDto, GenerateMealPlanDto, ChatDto } from './dto/ai.dto';

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
    private readonly mealPlanService: MealPlanService,
    private readonly chatService: ChatService,
    private readonly aiLogService: AILogService,
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
    try {
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
    } catch (error) {
      // 返回默认建议，避免前端报错
      return {
        type: 'ai',
        content: '保持均衡饮食，多吃蔬菜水果，适量摄入蛋白质和碳水化合物。记得多喝水！',
      };
    }
  }

  @Get('usage/me')
  @ApiOperation({ summary: '查询本月AI调用量与费用' })
  async getUsage(
    @CurrentUser('userId') userId: string,
    @Query('month') month?: string,
  ) {
    return this.aiLogService.getMonthlyStats(userId, month);
  }

  @Post('generate-plan')
  @ApiOperation({ summary: 'AI生成食谱' })
  async generateMealPlan(
    @CurrentUser('userId') userId: string,
    @Body() dto: GenerateMealPlanDto,
  ) {
    // 获取用户画像
    const profile = await this.userService.getProfile(userId).catch(() => null);

    // 构建用户画像数据
    const userProfile = {
      heightCm: dto.heightCm || profile?.heightCm,
      weightKg: dto.weightKg || profile?.weightKg,
      healthGoal: dto.healthGoal || profile?.healthGoal || '维持',
      dailyCalorieGoal: dto.calorieTarget || profile?.dailyCalorieGoal || 2000,
      mealCount: dto.mealCount || profile?.mealCount || 3,
      flavorPrefs: dto.flavorPrefs || profile?.flavorPrefs || [],
      allergyTags: profile?.allergyTags || [],
      age: this.calculateAge(profile?.birthDate ?? undefined),
      gender: profile?.gender,
    };

    // 调用AI生成食谱
    const aiResult = await this.aiService.generateMealPlan(userProfile);

    // 使用 MealPlanService 创建食谱
    const plan = await this.mealPlanService.generate(userId, {
      calorieTarget: userProfile.dailyCalorieGoal,
      mealCount: userProfile.mealCount,
      healthGoal: userProfile.healthGoal,
      flavorPrefs: userProfile.flavorPrefs,
      heightCm: userProfile.heightCm,
      weightKg: userProfile.weightKg,
    });

    return plan;
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI对话（非流式）' })
  async chat(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChatDto,
  ) {
    // 保存或获取会话
    let sessionId = dto.sessionId;
    if (!sessionId) {
      const session = await this.chatService.createSession(userId, { title: dto.message.slice(0, 20) });
      sessionId = session.id;
    }

    // 保存用户消息
    await this.chatService.saveMessage(sessionId, 'user', dto.message, userId);

    // 获取历史消息
    const history = await this.chatService.getMessages(sessionId);
    const messages = history.map(h => ({ role: h.role, content: h.content }));

    // 调用AI
    const content = await this.aiService.chat(messages);

    // 保存AI回复
    await this.chatService.saveMessage(sessionId, 'assistant', content, userId);

    // 更新会话消息数
    await this.chatService.updateMessageCount(sessionId);

    return {
      sessionId,
      content,
      messageCount: history.length + 1,
    };
  }

  @Get('chat/sessions')
  @ApiOperation({ summary: '获取会话列表' })
  async getChatSessions(@CurrentUser('userId') userId: string) {
    return this.chatService.getSessions(userId);
  }

  @Get('chat/sessions/:id')
  @ApiOperation({ summary: '获取会话消息历史' })
  async getChatSession(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const session = await this.chatService.getSession(userId, id);
    const messages = await this.chatService.getMessages(id);
    return {
      session,
      messages,
    };
  }

  @Delete('chat/sessions/:id')
  @ApiOperation({ summary: '删除会话' })
  async deleteChatSession(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.chatService.deleteSession(userId, id);
    return { message: '会话已删除' };
  }

  private calculateAge(birthDate: Date | undefined): number | undefined {
    if (!birthDate) return undefined;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
