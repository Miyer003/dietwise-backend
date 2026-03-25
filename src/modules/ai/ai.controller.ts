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
import { AnalyzeNutritionDto, GenerateTipDto, GenerateMealPlanDto, ChatDto, AnalyzeVoiceDto } from './dto/ai.dto';

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
  async analyzeNutrition(
    @CurrentUser('userId') userId: string,
    @Body() dto: AnalyzeNutritionDto,
  ) {
    const startTime = Date.now();
    
    try {
      // 图片分析（支持 URL 或 Base64）
      if (dto.type === 'image') {
        let result;
        if (dto.imageBase64) {
          result = await this.aiService.analyzeNutritionByBase64(dto.imageBase64);
        } else if (dto.imageUrl) {
          result = await this.aiService.analyzeNutrition(dto.imageUrl);
        } else {
          return { error: '请提供图片 URL 或 Base64 数据' };
        }
        
        // 记录AI调用日志
        await this.aiLogService.createLog({
          userId,
          functionType: AIFunctionType.NUTRITION_ANALYSIS,
          provider: AIProvider.DASHSCOPE,
          modelName: 'qwen-vl-plus',
          latencyMs: Date.now() - startTime,
          success: true,
        });
        
        return {
          ...result,
          isCached: false,
        };
      }

      // 文字描述分析
      if (!dto.description) {
        return { error: '请提供食物描述' };
      }
      
      const result = await this.aiService.analyzeNutritionByText(dto.description, dto.quantityG);
      
      // 记录AI调用日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.NUTRITION_ANALYSIS,
        provider: AIProvider.DASHSCOPE,
        modelName: 'qwen-turbo',
        latencyMs: Date.now() - startTime,
        success: true,
      });
      
      return result;
    } catch (error) {
      // 记录失败日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.NUTRITION_ANALYSIS,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  @Post('analyze-voice')
  @ApiOperation({ summary: '语音分析（语音识别+营养分析）' })
  async analyzeVoice(
    @CurrentUser('userId') userId: string,
    @Body() dto: AnalyzeVoiceDto,
  ) {
    const startTime = Date.now();
    
    try {
      // 1. 尝试语音识别
      let transcribedText = await this.aiService.speechToText(
        dto.audioBase64, 
        dto.mimeType
      );

      // 2. 如果语音识别失败，使用智能猜测
      let analysisResult: any;
      let isGuessed = false;
      
      if (!transcribedText || transcribedText.trim().length === 0) {
        const guess = await this.aiService.guessFoodFromAudio(dto.audioBase64);
        
        transcribedText = guess.foodName;
        isGuessed = true;
        
        // 基于猜测的食物进行营养分析
        analysisResult = await this.aiService.analyzeNutritionByText(
          guess.foodName,
          guess.quantityG
        );
        
        // 标记为猜测结果
        analysisResult.confidence = guess.confidence;
        analysisResult.isGuessed = true;
      } else {
        // 3. 正常营养分析
        analysisResult = await this.aiService.analyzeNutritionByText(
          transcribedText, 
          undefined
        );
      }

      // 记录AI调用日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.VOICE_ANALYSIS,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return {
        transcribedText,
        analysisResult,
        isGuessed,
      };
    } catch (error: any) {
      // 记录失败日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.VOICE_ANALYSIS,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  @Post('generate-tip')
  @ApiOperation({ summary: '生成今日AI健康建议' })
  async generateTip(@CurrentUser('userId') userId: string, @Body() dto: GenerateTipDto) {
    const startTime = Date.now();
    
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

      // 记录AI调用日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.TIP_GENERATION,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return {
        type: 'ai',
        content: aiResponse,
      };
    } catch (error) {
      // 记录失败日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.TIP_GENERATION,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
      
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
    const startTime = Date.now();
    
    try {
      // 直接使用 MealPlanService 生成食谱（内部会调用AI）
      const plan = await this.mealPlanService.generate(userId, {
        calorieTarget: dto.calorieTarget || 2000,
        mealCount: dto.mealCount || 3,
        healthGoal: dto.healthGoal || '维持',
        flavorPrefs: dto.flavorPrefs || [],
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
      } as any);

      // 记录AI调用日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.MEAL_PLAN_GENERATION,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return plan;
    } catch (error) {
      // 记录失败日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.MEAL_PLAN_GENERATION,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI对话（非流式）' })
  async chat(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChatDto,
  ) {
    const startTime = Date.now();
    
    try {
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

      // 记录AI调用日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.CHAT,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return {
        sessionId,
        content,
        messageCount: history.length + 1,
      };
    } catch (error) {
      // 记录失败日志
      await this.aiLogService.createLog({
        userId,
        functionType: AIFunctionType.CHAT,
        provider: AIProvider.DASHSCOPE,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
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
