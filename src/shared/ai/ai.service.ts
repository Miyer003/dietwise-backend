import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DashscopeService } from './dashscope.service';
import { MoonshotService } from './moonshot.service';
import { NutritionAnalysisResult, NutritionAnalysisResultWithTokens, ChatMessage, AICompletionResult, SpeechToTextResult } from './interfaces/ai.interface';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly dashscope: DashscopeService,
    private readonly moonshot: MoonshotService,
    private readonly config: ConfigService,
  ) {}

  // 营养分析：优先使用 Dashscope VL 模型（图片 URL）
  async analyzeNutrition(imageUrl: string): Promise<NutritionAnalysisResultWithTokens> {
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
        model: 'qwen-vl-plus',
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  // 营养分析：使用 Base64 图片
  async analyzeNutritionByBase64(base64Image: string): Promise<NutritionAnalysisResultWithTokens> {
    try {
      return await this.dashscope.analyzeNutritionByBase64(base64Image);
    } catch (error) {
      this.logger.error('AI 图片分析失败(Base64)，返回默认值:', error.message);
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
        model: 'qwen-vl-plus',
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  // 营养分析：通过文字描述
  async analyzeNutritionByText(description: string, quantityG?: number): Promise<NutritionAnalysisResult & { model?: string; inputTokens?: number; outputTokens?: number }> {
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
      const result = await this.dashscope.chatCompletion([
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          foodName: parsed.foodName || description.slice(0, 20),
          quantityG: parseFloat(parsed.quantityG) || quantityG || 100,
          calories: parseFloat(parsed.calories) || 0,
          proteinG: parseFloat(parsed.proteinG) || 0,
          carbsG: parseFloat(parsed.carbsG) || 0,
          fatG: parseFloat(parsed.fatG) || 0,
          fiberG: parseFloat(parsed.fiberG) || 0,
          sodiumMg: parseFloat(parsed.sodiumMg) || 0,
          confidence: parseFloat(parsed.confidence) || 0.8,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
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

  // 生成食谱：优先使用 Dashscope (Qwen)，失败时使用 Moonshot (Kimi)
  async generateMealPlan(userProfile: any, customRequest?: string): Promise<AICompletionResult> {
    const prompt = this.buildMealPlanPrompt(userProfile, customRequest);
    
    // 先尝试 Dashscope (Qwen)
    try {
      this.logger.log('尝试使用 Dashscope (Qwen) 生成食谱...');
      const result = await this.dashscope.chatCompletion([
        { 
          role: 'system', 
          content: '你是一位专业的营养师，擅长根据用户的身体数据和饮食偏好制定详细的膳食计划。请用中文回答，提供具体的一周食谱，包括每餐的菜品、食材分量、烹饪建议和营养分析。' 
        },
        { role: 'user', content: prompt }
      ]);
      if (result.content && result.content.length > 50) {
        this.logger.log('Dashscope (Qwen) 生成食谱成功');
        return result;
      }
      throw new Error('Dashscope 返回内容太短');
    } catch (dashscopeError) {
      this.logger.warn(`Dashscope (Qwen) 失败: ${dashscopeError.message}，尝试 Moonshot (Kimi)...`);
      
      // 降级到 Moonshot (Kimi)
      try {
        this.logger.log('尝试使用 Moonshot (Kimi) 生成食谱...');
        const moonshotResult = await this.moonshot.generateMealPlan(prompt);
        if (moonshotResult && moonshotResult.length > 50) {
          this.logger.log('Moonshot (Kimi) 生成食谱成功');
          return {
            content: moonshotResult,
            model: this.config.get('app.ai.moonshot.model') || 'moonshot-v1-8k',
            inputTokens: 0,
            outputTokens: 0,
          };
        }
        throw new Error('Moonshot 返回内容太短');
      } catch (moonshotError) {
        this.logger.error(`Moonshot (Kimi) 也失败: ${moonshotError.message}`);
        // 返回默认食谱模板
        return {
          content: this.getDefaultMealPlan(userProfile),
          model: 'fallback',
          inputTokens: 0,
          outputTokens: 0,
        };
      }
    }
  }

  // 简单聊天：使用 Dashscope turbo（更快更便宜）
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const result = await this.dashscope.chatCompletion(messages);
      return result.content;
    } catch (error) {
      this.logger.error('AI 聊天失败:', error.message);
      // 返回友好的错误提示
      return '抱歉，AI 服务暂时不可用，请稍后再试。';
    }
  }

  // 聊天并返回完整信息（包含Token使用量）
  async chatWithTokens(messages: ChatMessage[]): Promise<AICompletionResult> {
    try {
      return await this.dashscope.chatCompletion(messages);
    } catch (error) {
      this.logger.error('AI 聊天失败:', error.message);
      // 返回默认值
      return {
        content: '抱歉，AI 服务暂时不可用，请稍后再试。',
        model: 'qwen-turbo',
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  // 语音识别：将音频转为文字
  async speechToText(audioBase64: string, mimeType?: string): Promise<SpeechToTextResult> {
    try {
      return await this.dashscope.speechToText(audioBase64, mimeType);
    } catch (error) {
      this.logger.error('语音识别失败:', error.message);
      // 返回空结果，让上层处理
      return {
        text: '',
        model: 'qwen-omni-turbo',
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  // 智能食物识别：基于音频特征猜测食物
  async guessFoodFromAudio(audioBase64: string): Promise<{
    foodName: string;
    quantityG: number;
    confidence: number;
  }> {
    // 基于音频文件大小和格式进行智能猜测
    const audioSize = audioBase64.length;
    const estimatedDuration = Math.max(1, Math.round(audioSize / 1000)); // 粗略估计时长
    
    this.logger.log(`音频特征分析 - 大小: ${audioSize}, 估计时长: ${estimatedDuration}秒`);
    
    // 构建提示词，让 AI 根据音频特征猜测最可能的食物
    const prompt = `作为一位智能营养师，用户刚刚通过语音描述了他们吃的食物。
根据以下音频特征，猜测用户最可能描述的食物：
- 音频大小: ${audioSize} bytes
- 估计时长: ${estimatedDuration} 秒
- 常见早餐: 豆浆油条、包子、粥、鸡蛋、牛奶
- 常见午餐/晚餐: 米饭、面条、炒菜、盖浇饭
- 常见加餐: 水果、坚果、酸奶

请返回最可能的食物名称，JSON格式：
{"foodName": "食物名称", "quantityG": 份量克数, "confidence": 0.8}`;

    try {
      const result = await this.dashscope.chatCompletion([
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          foodName: parsed.foodName || '未知食物',
          quantityG: parseInt(parsed.quantityG) || 200,
          confidence: parseFloat(parsed.confidence) || 0.6,
        };
      }
    } catch (error) {
      this.logger.error('智能猜测失败:', error.message);
    }
    
    // 默认返回
    return {
      foodName: '一份餐食',
      quantityG: 200,
      confidence: 0.5,
    };
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
      const result = await this.dashscope.chatCompletion(messages);
      fullContent = result.content;
      
      // 模拟流式输出（按字符分批发送）
      const chunks = result.content.split('');
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

  private buildMealPlanPrompt(profile: any, customRequest?: string): string {
    const difficultyHint = profile.cookingDifficulty ? 
      `烹饪难度要求：${profile.cookingDifficulty}` : '';
    const restrictionsHint = profile.restrictions?.length ? 
      `饮食限制/忌口：${profile.restrictions.join('、')}` : '';
    const customHint = customRequest ? 
      `用户特殊要求：${customRequest}` : '';

    // 根据健康目标计算营养比例
    let proteinPercent = 30;
    let carbsPercent = 45;
    let fatPercent = 25;
    if (profile.healthGoal === '减脂') {
      proteinPercent = 35; carbsPercent = 35; fatPercent = 30;
    } else if (profile.healthGoal === '增肌') {
      proteinPercent = 40; carbsPercent = 40; fatPercent = 20;
    }

    return `你是一位专业的营养师，请为以下用户制定一周的详细膳食计划。

【用户资料】
- 身高：${profile.heightCm || '未知'}cm，体重：${profile.weightKg || '未知'}kg
- 饮食目标：${profile.healthGoal}
- 每日热量目标：${profile.dailyCalorieGoal} kcal
- 每日餐数：${profile.mealCount} 餐
- 口味偏好：${profile.flavorPrefs?.join(', ') || '无特殊要求'}
- 过敏原：${profile.allergyTags?.join(', ') || '无'}
${difficultyHint}
${restrictionsHint}
${customHint}

【营养比例要求】
${profile.healthGoal}目标的营养配比：蛋白质${proteinPercent}% / 碳水${carbsPercent}% / 脂肪${fatPercent}%

【输出要求】
1. 必须严格按照以下JSON格式返回，不要添加任何markdown标记或其他文字
2. 必须提供完整的7天食谱（dayOfWeek: 1-7）
3. 每天必须包含${profile.mealCount}餐（早餐breakfast、午餐lunch、晚餐dinner${profile.mealCount > 3 ? '、加餐snack' : ''}）
4. 每道菜必须包含：name（菜品名称）、quantityG（克数）、calories（卡路里）、proteinG（蛋白质）、carbsG（碳水）、fatG（脂肪）、cookingTip（烹饪建议）
5. 每天总热量必须接近${profile.dailyCalorieGoal}kcal（±100kcal）

【JSON格式示例】
{
  "days": [
    {
      "dayOfWeek": 1,
      "dayName": "周一",
      "totalCalories": ${profile.dailyCalorieGoal},
      "meals": [
        {
          "mealType": "breakfast",
          "mealName": "早餐",
          "dishes": [
            {
              "name": "燕麦粥",
              "quantityG": 50,
              "calories": 150,
              "proteinG": 5,
              "carbsG": 27,
              "fatG": 3,
              "cookingTip": "加水煮至软烂"
            }
          ],
          "mealCalories": 150,
          "mealProtein": 5,
          "mealCarbs": 27,
          "mealFat": 3
        }
      ],
      "dailyNutrition": {
        "proteinG": ${Math.round(profile.dailyCalorieGoal * proteinPercent / 100 / 4)},
        "carbsG": ${Math.round(profile.dailyCalorieGoal * carbsPercent / 100 / 4)},
        "fatG": ${Math.round(profile.dailyCalorieGoal * fatPercent / 100 / 9)},
        "proteinPercent": ${proteinPercent},
        "carbsPercent": ${carbsPercent},
        "fatPercent": ${fatPercent}
      }
    }
  ]
}

【重要】只返回纯JSON，不要markdown代码块，不要解释文字！`;
  }

  // 默认食谱模板（当 AI 服务都失败时使用）
  private getDefaultMealPlan(profile: any): string {
    const calorieTarget = profile.dailyCalorieGoal || 2000;
    const mealCount = profile.mealCount || 3;
    const goal = profile.healthGoal || '维持';
    const breakfastCal = Math.round(calorieTarget * 0.25);
    const lunchCal = Math.round(calorieTarget * 0.4);
    const dinnerCal = Math.round(calorieTarget * 0.35);
    
    return `{
  "days": [
    {
      "dayOfWeek": 1,
      "dayName": "周一",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "燕麦粥", "quantityG": 50, "calories": ${Math.round(breakfastCal * 0.4)}, "cookingTip": "用低脂牛奶煮制"}, {"name": "水煮蛋", "quantityG": 50, "calories": ${Math.round(breakfastCal * 0.3)}, "cookingTip": "冷水下锅煮8分钟"}, {"name": "脱脂牛奶", "quantityG": 200, "calories": ${Math.round(breakfastCal * 0.3)}, "cookingTip": "温热饮用更佳"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "糙米饭", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "提前浸泡30分钟"}, {"name": "清蒸鲈鱼", "quantityG": 120, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "蒸8-10分钟，加姜丝葱段"}, {"name": "蒜蓉西兰花", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.2)}, "cookingTip": "快炒保持脆嫩"}, {"name": "番茄蛋汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.1)}, "cookingTip": "少油清淡"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "杂粮粥", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "多种杂粮混合"}, {"name": "凉拌豆腐", "quantityG": 150, "calories": ${Math.round(dinnerCal * 0.3)}, "cookingTip": "加少量香油和酱油"}, {"name": "清炒时蔬", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.3)}, "cookingTip": "少油快炒"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    },
    {
      "dayOfWeek": 2,
      "dayName": "周二",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "全麦面包", "quantityG": 80, "calories": ${Math.round(breakfastCal * 0.4)}, "cookingTip": "可配少量果酱"}, {"name": "煎蛋", "quantityG": 50, "calories": ${Math.round(breakfastCal * 0.35)}, "cookingTip": "少油煎制"}, {"name": "豆浆", "quantityG": 250, "calories": ${Math.round(breakfastCal * 0.25)}, "cookingTip": "无糖豆浆更健康"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "藜麦饭", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "藜麦提前浸泡"}, {"name": "宫保鸡丁", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "少油少盐版本"}, {"name": "凉拌黄瓜", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "清爽开胃"}, {"name": "紫菜蛋花汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "关火后淋入蛋液"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "小米粥", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "小火慢熬"}, {"name": "蒸蛋羹", "quantityG": 150, "calories": ${Math.round(dinnerCal * 0.35)}, "cookingTip": "加温水搅拌均匀"}, {"name": "白灼菜心", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.25)}, "cookingTip": "水开焯烫1分钟"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    },
    {
      "dayOfWeek": 3,
      "dayName": "周三",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "玉米", "quantityG": 150, "calories": ${Math.round(breakfastCal * 0.4)}, "cookingTip": "蒸煮均可"}, {"name": "鸡蛋羹", "quantityG": 100, "calories": ${Math.round(breakfastCal * 0.35)}, "cookingTip": "嫩滑口感"}, {"name": "牛奶", "quantityG": 200, "calories": ${Math.round(breakfastCal * 0.25)}, "cookingTip": "温热饮用"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "荞麦面", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "过冷水更劲道"}, {"name": "酱牛肉", "quantityG": 100, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "切片薄厚适中"}, {"name": "拌菠菜", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.2)}, "cookingTip": "焯水后过凉"}, {"name": "冬瓜汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.1)}, "cookingTip": "清淡利尿"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "南瓜粥", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "南瓜软糯香甜"}, {"name": "清蒸虾", "quantityG": 120, "calories": ${Math.round(dinnerCal * 0.35)}, "cookingTip": "蒸3-5分钟即可"}, {"name": "凉拌木耳", "quantityG": 150, "calories": ${Math.round(dinnerCal * 0.25)}, "cookingTip": "提前泡发"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    },
    {
      "dayOfWeek": 4,
      "dayName": "周四",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "紫薯", "quantityG": 150, "calories": ${Math.round(breakfastCal * 0.4)}, "cookingTip": "蒸熟后剥皮"}, {"name": "茶叶蛋", "quantityG": 60, "calories": ${Math.round(breakfastCal * 0.35)}, "cookingTip": "自制少盐版本"}, {"name": "酸奶", "quantityG": 150, "calories": ${Math.round(breakfastCal * 0.25)}, "cookingTip": "无糖原味"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "黑米饭", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "黑米需多煮一会"}, {"name": "红烧鸡腿", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "去皮减少脂肪"}, {"name": "清炒豆芽", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "大火快炒"}, {"name": "白菜豆腐汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "清淡暖胃"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "燕麦粥", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "可加少许枸杞"}, {"name": "蒸蛋", "quantityG": 100, "calories": ${Math.round(dinnerCal * 0.35)}, "cookingTip": "嫩滑细腻"}, {"name": "蒜蓉生菜", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.25)}, "cookingTip": "快速翻炒"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    },
    {
      "dayOfWeek": 5,
      "dayName": "周五",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "山药", "quantityG": 150, "calories": ${Math.round(breakfastCal * 0.4)}, "cookingTip": "蒸煮均可健脾"}, {"name": "水煮蛋", "quantityG": 50, "calories": ${Math.round(breakfastCal * 0.35)}, "cookingTip": "全熟蛋"}, {"name": "豆浆", "quantityG": 250, "calories": ${Math.round(breakfastCal * 0.25)}, "cookingTip": "温热饮用"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "红薯饭", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "红薯切块同煮"}, {"name": "清蒸带鱼", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "腌制去腥"}, {"name": "凉拌芹菜", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "爽脆口感"}, {"name": "丝瓜蛋汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "清淡解暑"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "红豆薏米粥", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "祛湿健脾"}, {"name": "白灼虾", "quantityG": 100, "calories": ${Math.round(dinnerCal * 0.35)}, "cookingTip": "蘸料清淡"}, {"name": "凉拌黄瓜", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.25)}, "cookingTip": "爽脆开胃"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    },
    {
      "dayOfWeek": 6,
      "dayName": "周六",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "全麦三明治", "quantityG": 120, "calories": ${Math.round(breakfastCal * 0.5)}, "cookingTip": "夹鸡蛋和蔬菜"}, {"name": "牛奶", "quantityG": 250, "calories": ${Math.round(breakfastCal * 0.3)}, "cookingTip": "搭配早餐"}, {"name": "小番茄", "quantityG": 100, "calories": ${Math.round(breakfastCal * 0.2)}, "cookingTip": "清新解腻"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "意大利面", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.4)}, "cookingTip": "番茄酱少油"}, {"name": "煎鸡胸", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "少油煎至金黄"}, {"name": "蔬菜沙拉", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "油醋汁调味"}, {"name": "蘑菇汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.1)}, "cookingTip": "鲜美浓郁"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "紫薯粥", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "香甜软糯"}, {"name": "蒸蛋", "quantityG": 100, "calories": ${Math.round(dinnerCal * 0.35)}, "cookingTip": "嫩滑口感"}, {"name": "白灼芥兰", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.25)}, "cookingTip": "保持翠绿"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    },
    {
      "dayOfWeek": 7,
      "dayName": "周日",
      "totalCalories": ${calorieTarget},
      "meals": [
        {"mealType": "breakfast", "mealName": "早餐", "dishes": [{"name": "水果燕麦", "quantityG": 80, "calories": ${Math.round(breakfastCal * 0.4)}, "cookingTip": "加酸奶或牛奶"}, {"name": "水煮蛋", "quantityG": 50, "calories": ${Math.round(breakfastCal * 0.3)}, "cookingTip": "搭配早餐"}, {"name": "香蕉", "quantityG": 100, "calories": ${Math.round(breakfastCal * 0.3)}, "cookingTip": "补充能量"}], "mealCalories": ${breakfastCal}},
        {"mealType": "lunch", "mealName": "午餐", "dishes": [{"name": "杂粮饭", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "多种谷物搭配"}, {"name": "红烧鱼块", "quantityG": 150, "calories": ${Math.round(lunchCal * 0.35)}, "cookingTip": "少油少盐"}, {"name": "炒时蔬", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "应季蔬菜"}, {"name": "番茄蛋汤", "quantityG": 200, "calories": ${Math.round(lunchCal * 0.15)}, "cookingTip": "经典搭配"}], "mealCalories": ${lunchCal}},
        {"mealType": "dinner", "mealName": "晚餐", "dishes": [{"name": "绿豆汤", "quantityG": 250, "calories": ${Math.round(dinnerCal * 0.4)}, "cookingTip": "消暑解渴"}, {"name": "蒸蛋羹", "quantityG": 150, "calories": ${Math.round(dinnerCal * 0.35)}, "cookingTip": "嫩滑细腻"}, {"name": "凉拌菠菜", "quantityG": 200, "calories": ${Math.round(dinnerCal * 0.25)}, "cookingTip": "补铁佳品"}], "mealCalories": ${dinnerCal}}
      ],
      "nutrition": {"proteinG": ${Math.round(calorieTarget * 0.3 / 4)}, "carbsG": ${Math.round(calorieTarget * 0.5 / 4)}, "fatG": ${Math.round(calorieTarget * 0.2 / 9)}}
    }
  ],
  "note": "此为默认食谱模板，AI服务暂时不可用。建议稍后重新生成个性化食谱。"
}`;
  }
}
