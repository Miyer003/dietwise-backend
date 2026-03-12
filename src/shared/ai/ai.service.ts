import { Injectable, Logger } from '@nestjs/common';
import { DashscopeService } from './dashscope.service';
import { MoonshotService } from './moonshot.service';
import { NutritionAnalysisResult, ChatMessage } from './interfaces/ai.interface';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly dashscope: DashscopeService,
    private readonly moonshot: MoonshotService,
  ) {}

  // 营养分析：优先使用 Dashscope VL 模型（图片）
  async analyzeNutrition(imageUrl: string): Promise<NutritionAnalysisResult> {
    try {
      return await this.dashscope.analyzeNutritionByImage(imageUrl);
    } catch (error) {
      this.logger.error('AI 图片分析失败，返回默认值:', error.message);
      // 返回默认值，避免前端报错
      return {
        foodName: '未知食物',
        quantityG: 100,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        sodiumMg: 0,
        confidence: 0.5,
      };
    }
  }

  // 营养分析：通过文字描述
  async analyzeNutritionByText(description: string, quantityG?: number): Promise<NutritionAnalysisResult> {
    const prompt = `请分析以下食物的营养成分：

食物描述：${description}
${quantityG ? `份量：${quantityG}克` : '份量请根据描述合理估算'}

请以JSON格式返回：
{
  "foodName": "菜品名称",
  "quantityG": 份量(克),
  "calories": 热量(kcal),
  "proteinG": 蛋白质(g),
  "carbsG": 碳水(g),
  "fatG": 脂肪(g),
  "fiberG": 膳食纤维(g),
  "sodiumMg": 钠(mg),
  "confidence": 置信度(0-1)
}`;

    try {
      const response = await this.dashscope.chatCompletion([
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          foodName: result.foodName || description.slice(0, 20),
          quantityG: parseFloat(result.quantityG) || quantityG || 100,
          calories: parseFloat(result.calories) || 0,
          proteinG: parseFloat(result.proteinG) || 0,
          carbsG: parseFloat(result.carbsG) || 0,
          fatG: parseFloat(result.fatG) || 0,
          fiberG: parseFloat(result.fiberG) || 0,
          sodiumMg: parseFloat(result.sodiumMg) || 0,
          confidence: parseFloat(result.confidence) || 0.8,
        };
      }
      throw new Error('无法解析AI返回内容');
    } catch (error) {
      this.logger.error(`文字营养分析失败: ${error.message}`);
      // 返回默认值
      return {
        foodName: description.slice(0, 20),
        quantityG: quantityG || 100,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        sodiumMg: 0,
        confidence: 0.5,
      };
    }
  }

  // 生成食谱：使用 Moonshot 长文本模型，失败时使用 Dashscope
  async generateMealPlan(userProfile: any): Promise<string> {
    const prompt = this.buildMealPlanPrompt(userProfile);
    
    // 先尝试 Moonshot
    try {
      this.logger.log('尝试使用 Moonshot 生成食谱...');
      const result = await this.moonshot.generateMealPlan(prompt);
      if (result && result.length > 50) {
        return result;
      }
      throw new Error('Moonshot 返回内容太短');
    } catch (moonshotError) {
      this.logger.warn(`Moonshot 失败: ${moonshotError.message}，尝试 Dashscope...`);
      
      // 降级到 Dashscope
      try {
        const result = await this.dashscope.chatCompletion([
          { role: 'user', content: prompt }
        ]);
        if (result && result.length > 50) {
          return result;
        }
        throw new Error('Dashscope 返回内容太短');
      } catch (dashscopeError) {
        this.logger.error(`Dashscope 也失败: ${dashscopeError.message}`);
        // 返回默认食谱模板
        return this.getDefaultMealPlan(userProfile);
      }
    }
  }

  // 简单聊天：使用 Dashscope turbo（更快更便宜）
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      return await this.dashscope.chatCompletion(messages);
    } catch (error) {
      this.logger.error('AI 聊天失败:', error.message);
      // 返回友好的错误提示
      return '抱歉，AI 服务暂时不可用，请稍后再试。';
    }
  }

  // 流式聊天（使用 Dashscope 模拟流式效果）
  async chatStream(
    messages: ChatMessage[],
    callbacks: {
      onDelta: (delta: string) => void;
      onComplete: (fullContent: string) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    let fullContent = '';
    
    try {
      // 使用 Dashscope 非流式接口，然后模拟流式输出
      const response = await this.dashscope.chatCompletion(messages);
      fullContent = response;
      
      // 模拟流式输出（按字符分批发送）
      const chunks = response.split('');
      for (const chunk of chunks) {
        callbacks.onDelta(chunk);
        // 添加小延迟模拟打字效果
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      callbacks.onComplete(fullContent);
    } catch (error) {
      this.logger.error('流式聊天失败:', error);
      callbacks.onError(error as Error);
    }
  }

  private buildMealPlanPrompt(profile: any): string {
    return `请为以下用户制定一周的详细膳食计划：

用户资料：
- 身高：${profile.heightCm}cm，体重：${profile.weightKg}kg，目标：${profile.healthGoal}
- 每日热量目标：${profile.dailyCalorieGoal} kcal
- 每日餐次：${profile.mealCount} 餐
- 口味偏好：${profile.flavorPrefs?.join(', ') || '无特殊要求'}
- 过敏原：${profile.allergyTags?.join(', ') || '无'}

要求：
1. 提供周一至周日每天的具体食谱
2. 每餐列出具体菜品、建议食材分量(g)、烹饪方法
3. 确保营养均衡，蛋白质/碳水/脂肪比例合理
4. 总热量控制在目标范围内（±100kcal）
5. 给出简要的每日营养分析

请用中文回答，格式清晰易读。`;
  }

  // 默认食谱模板（当 AI 服务都失败时使用）
  private getDefaultMealPlan(profile: any): string {
    const calorieTarget = profile.dailyCalorieGoal || 2000;
    const mealCount = profile.mealCount || 3;
    const goal = profile.healthGoal || '维持';
    
    return `## 一周膳食计划（${goal}目标）

### 周一
**早餐** (约 ${Math.round(calorieTarget * 0.25)} kcal)
- 燕麦粥 50g + 牛奶 200ml + 水煮蛋 1个

**午餐** (约 ${Math.round(calorieTarget * 0.4)} kcal)
- 米饭 150g + 清蒸鱼 100g + 炒时蔬 200g

**晚餐** (约 ${Math.round(calorieTarget * 0.35)} kcal)
- 杂粮粥 100g + 凉拌豆腐 150g + 炒青菜 200g

### 周二至周日
（按周一模式轮换，可根据个人喜好调整）

---
*注：此为默认模板，AI 服务暂时不可用。建议稍后重新生成个性化食谱。*`;
  }
}
