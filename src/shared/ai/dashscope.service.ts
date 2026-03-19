import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { NutritionAnalysisResult } from './interfaces/ai.interface';

@Injectable()
export class DashscopeService {
  private readonly logger = new Logger(DashscopeService.name);
  private readonly apiKey: string;
  // 使用 OpenAI 兼容接口
  private readonly baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.apiKey = this.config.get('app.ai.dashscope.apiKey') || '';
    if (!this.apiKey) {
      this.logger.warn('Dashscope API Key 未配置');
    } else {
      this.logger.log(`Dashscope API Key 已配置: ${this.apiKey.slice(0, 8)}...`);
    }
  }

  async analyzeNutritionByImage(imageUrl: string): Promise<NutritionAnalysisResult> {
    try {
      const response = await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.config.get('app.ai.dashscope.vlModel') || 'qwen-vl-plus',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } },
                  { type: 'text', text: '请分析这张食物图片，识别菜品名称，估算份量（克），并分析营养成分（热量kcal、蛋白质g、碳水g、脂肪g、膳食纤维g、钠mg）。以JSON格式返回：{"foodName": "菜品名", "quantityG": 150, "calories": 200, "proteinG": 15, "carbsG": 20, "fatG": 8, "fiberG": 3, "sodiumMg": 500}' }
                ]
              }
            ]
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
      const content = (response as any).data?.choices?.[0]?.message?.content || '';
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
    } catch (error: any) {
      this.logger.error(`AI 图像分析失败: ${error.message}`);
      if (error.response?.status === 401) {
        this.logger.error('Dashscope API Key 无效或已过期，请检查 .env 文件中的 DASHSCOPE_API_KEY');
      }
      if (error.response?.data) {
        this.logger.error('错误详情:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  async analyzeNutritionByBase64(base64Image: string): Promise<NutritionAnalysisResult> {
    try {
      // 构建 data URL
      const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      const response = await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.config.get('app.ai.dashscope.vlModel') || 'qwen-vl-plus',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageDataUrl } },
                  { type: 'text', text: '请分析这张食物图片，识别菜品名称，估算份量（克），并分析营养成分（热量kcal、蛋白质g、碳水g、脂肪g、膳食纤维g、钠mg）。以JSON格式返回：{"foodName": "菜品名", "quantityG": 150, "calories": 200, "proteinG": 15, "carbsG": 20, "fatG": 8, "fiberG": 3, "sodiumMg": 500}' }
                ]
              }
            ]
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
      const content = (response as any).data?.choices?.[0]?.message?.content || '';
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
    } catch (error: any) {
      this.logger.error(`AI 图像分析失败(Base64): ${error.message}`);
      if (error.response?.status === 401) {
        this.logger.error('Dashscope API Key 无效或已过期');
      }
      if (error.response?.data) {
        this.logger.error('错误详情:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  async chatCompletion(messages: any[]): Promise<string> {
    try {
      // 转换消息格式以兼容 OpenAI 格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.config.get('app.ai.dashscope.textModel') || 'qwen-turbo',
            messages: formattedMessages,
          },
          {
            headers: { 
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      return (response as any).data?.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      this.logger.error(`AI 对话失败: ${error.message}`);
      if (error.response?.status === 401) {
        this.logger.error('Dashscope API Key 无效或已过期，请检查 .env 文件中的 DASHSCOPE_API_KEY');
      }
      if (error.response?.data) {
        this.logger.error('错误详情:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  // 语音识别：使用 qwen-omni-turbo 全模态模型（Dashscope 原生 API）
  async speechToText(audioBase64: string, mimeType?: string): Promise<string> {
    try {
      this.logger.log(`开始语音识别，mimeType: ${mimeType}, 音频长度: ${audioBase64.length}`);
      
      // 确定音频格式并构建 data URL
      const format = mimeType?.includes('wav') ? 'wav' : 
                    mimeType?.includes('m4a') ? 'm4a' : 
                    mimeType?.includes('mp3') ? 'mp3' : 'mp3';
      const audioDataUrl = `data:audio/${format};base64,${audioBase64}`;
      
      // 获取配置的音频模型
      const audioModel = this.config.get('app.ai.dashscope.audioModel') || 'qwen-omni-turbo';
      this.logger.log(`使用模型: ${audioModel}`);
      
      // 使用 Dashscope 原生 API 调用 qwen-omni-turbo 模型
      const response = await lastValueFrom(
        this.http.post(
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
          {
            model: audioModel,
            input: {
              messages: [
                {
                  role: 'user',
                  content: [
                    { audio: audioDataUrl },
                    { text: '请识别这段音频中的文字内容，只返回识别出的文字，不要添加任何解释或标点符号。' }
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

      // 解析响应
      const choices = (response as any).data?.output?.choices;
      if (choices && choices.length > 0) {
        const content = choices[0].message?.content;
        let text = '';
        
        // 处理多模态返回格式
        if (Array.isArray(content)) {
          // 查找 text 类型的内容
          const textItem = content.find((item: any) => item.text);
          text = textItem?.text || '';
        } else if (typeof content === 'string') {
          text = content;
        }
        
        this.logger.log(`语音识别成功: ${text}`);
        
        // 清理返回的内容（去除可能的描述性文字）
        text = text.trim()
          .replace(/^这段音频中包含的文字是：['"]/, '')
          .replace(/['"]$/g, '')
          .replace(/^["']|["']$/g, '');
        
        return text;
      }
      
      throw new Error('语音识别返回空结果');
    } catch (error: any) {
      this.logger.error(`语音识别失败: ${error.message}`);
      if (error.response?.data) {
        this.logger.error('错误详情:', JSON.stringify(error.response.data));
      }
      
      // 如果全模态模型失败，尝试使用 Paraformer 专用语音模型
      return this.fallbackSpeechToText(audioBase64, mimeType);
    }
  }

  // 备选语音识别：使用 Paraformer 专用语音模型
  private async fallbackSpeechToText(audioBase64: string, mimeType?: string): Promise<string> {
    try {
      this.logger.log('使用备选方案：Paraformer 语音识别');
      
      const format = mimeType?.includes('wav') ? 'wav' : 
                    mimeType?.includes('m4a') ? 'm4a' : 'mp3';
      
      const response = await lastValueFrom(
        this.http.post(
          'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
          {
            model: 'paraformer-v2',
            input: {
              audio: audioBase64,
            },
            parameters: {
              format: format,
              sample_rate: 16000,
              disfluency_removal_enabled: true,
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

      const result = (response as any).data?.output?.text || '';
      if (result) {
        this.logger.log(`备选语音识别成功: ${result}`);
        return result.trim();
      }
      throw new Error('备选语音识别返回空结果');
    } catch (error: any) {
      this.logger.error(`备选语音识别也失败: ${error.message}`);
      // 返回空字符串，让上层触发智能猜测
      return '';
    }
  }
}
