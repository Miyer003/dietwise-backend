import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { NutritionAnalysisResult } from './interfaces/ai.interface';

@Injectable()
export class DashscopeService {
  private readonly logger = new Logger(DashscopeService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://dashscope.aliyuncs.com/api/v1';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.apiKey = this.config.get('app.ai.dashscope.apiKey') || '';
  }

  async analyzeNutritionByImage(imageUrl: string): Promise<NutritionAnalysisResult> {
    try {
      const response = await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/services/aigc/multimodal-generation/generation`,
          {
            model: this.config.get('app.ai.dashscope.vlModel'),
            input: {
              messages: [
                {
                  role: 'user',
                  content: [
                    { image: imageUrl },
                    { text: '请分析这张食物图片，识别菜品名称，估算份量（克），并分析营养成分（热量kcal、蛋白质g、碳水g、脂肪g、膳食纤维g、钠mg）。以JSON格式返回：{"foodName": "菜品名", "quantityG": 150, "calories": 200, "proteinG": 15, "carbsG": 20, "fatG": 8, "fiberG": 3, "sodiumMg": 500}' }
                  ]
                }
              ]
            }
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // 解析 VL 模型返回的文本内容
      const content = (response as any).data?.output?.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          foodName: result.foodName || '未知食物',
          quantityG: parseFloat(result.quantityG) || 100,
          calories: parseFloat(result.calories) || 0,
          proteinG: parseFloat(result.proteinG) || 0,
          carbsG: parseFloat(result.carbsG) || 0,
          fatG: parseFloat(result.fatG) || 0,
          fiberG: parseFloat(result.fiberG) || 0,
          sodiumMg: parseFloat(result.sodiumMg) || 0,
          confidence: 0.9,
        };
      }
      throw new Error('无法解析 AI 返回内容');
    } catch (error) {
      this.logger.error(`AI 图像分析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async chatCompletion(messages: any[]): Promise<string> {
    try {
      const response = await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/services/aigc/text-generation/generation`,
          {
            model: this.config.get('app.ai.dashscope.textModel'),
            input: { messages },
            parameters: {
              result_format: 'message',
            },
          },
          {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          },
        ),
      );
      return (response as any).data?.output?.choices?.[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`AI 对话失败: ${error.message}`);
      throw error;
    }
  }
}