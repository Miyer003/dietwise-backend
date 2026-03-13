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

  // 营养分析：优先使用 Dashscope VL 模型（图片 URL）
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

  // 营养分析：使用 Base64 图片
  async analyzeNutritionByBase64(base64Image: string): Promise<NutritionAnalysisResult> {
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

  // 生成食谱：优先使用 Dashscope (Qwen)，失败时使用 Moonshot (Kimi)
  async generateMealPlan(userProfile: any, customRequest?: string): Promise<string> {
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
      if (result && result.length > 50) {
        this.logger.log('Dashscope (Qwen) 生成食谱成功');
        return result;
      }
      throw new Error('Dashscope 返回内容太短');
    } catch (dashscopeError) {
      this.logger.warn(`Dashscope (Qwen) 失败: ${dashscopeError.message}，尝试 Moonshot (Kimi)...`);
      
      // 降级到 Moonshot (Kimi)
      try {
        this.logger.log('尝试使用 Moonshot (Kimi) 生成食谱...');
        const result = await this.moonshot.generateMealPlan(prompt);
        if (result && result.length > 50) {
          this.logger.log('Moonshot (Kimi) 生成食谱成功');
          return result;
        }
        throw new Error('Moonshot 返回内容太短');
      } catch (moonshotError) {
        this.logger.error(`Moonshot (Kimi) 也失败: ${moonshotError.message}`);
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

  private buildMealPlanPrompt(profile: any, customRequest?: string): string {
    const difficultyHint = profile.cookingDifficulty ? 
      `烹饪难度要求：${profile.cookingDifficulty}` : '';
    const restrictionsHint = profile.restrictions?.length ? 
      `饮食限制/忌口：${profile.restrictions.join('、')}` : '';
    const customHint = customRequest ? 
      `用户特殊要求：${customRequest}` : '';

    return `请为以下用户制定一周的详细膳食计划，必须以JSON格式返回：

用户资料：
- 身高：${profile.heightCm || '未知'}cm，体重：${profile.weightKg || '未知'}kg，目标：${profile.healthGoal}
- 每日热量目标：${profile.dailyCalorieGoal} kcal
- 每日餐次：${profile.mealCount} 餐
- 口味偏好：${profile.flavorPrefs?.join(', ') || '无特殊要求'}
- 过敏原：${profile.allergyTags?.join(', ') || '无'}
${difficultyHint}
${restrictionsHint}
${customHint}

要求：
1. 提供周一至周日（7天）每天的完整食谱
2. 每餐必须包含：具体菜品名称、食材分量(g)、卡路里(kcal)、烹饪建议、蛋白质(g)、碳水(g)、脂肪(g)
3. 确保营养均衡，蛋白质/碳水/脂肪比例根据"${profile.healthGoal}"目标调整：
   - 减脂：蛋白质 35%、碳水 35%、脂肪 30%
   - 增肌：蛋白质 40%、碳水 40%、脂肪 20%
   - 维持：蛋白质 30%、碳水 45%、脂肪 25%
4. 每天总热量严格控制在 ${profile.dailyCalorieGoal}±100kcal 范围内
5. 菜品要符合中国人口味，烹饪方式要实用可行
6. 食材搭配要多样化，避免重复

【重要】请以如下JSON格式返回，不要包含其他文字：
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
              "name": "菜品名称",
              "quantityG": 100,
              "calories": 300,
              "proteinG": 15,
              "carbsG": 30,
              "fatG": 10,
              "cookingTip": "烹饪建议"
            }
          ],
          "mealCalories": 500,
          "mealProtein": 20,
          "mealCarbs": 50,
          "mealFat": 15
        }
      ],
      "dailyNutrition": {
        "proteinG": 120,
        "carbsG": 150,
        "fatG": 55,
        "proteinPercent": 30,
        "carbsPercent": 45,
        "fatPercent": 25
      }
    }
  ]
}`;
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
