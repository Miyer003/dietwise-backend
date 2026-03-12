import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class MoonshotService {
  private readonly logger = new Logger(MoonshotService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.moonshot.cn/v1';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.apiKey = this.config.get('app.ai.moonshot.apiKey') || '';
    if (!this.apiKey) {
      this.logger.warn('Moonshot API Key 未配置');
    } else {
      this.logger.log(`Moonshot API Key 已配置: ${this.apiKey.slice(0, 8)}...`);
    }
  }

  async generateMealPlan(prompt: string): Promise<string> {
    try {
      const response = await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.config.get('app.ai.moonshot.model'),
            messages: [
              {
                role: 'system',
                content: '你是一位专业的营养师，擅长根据用户的身体数据和饮食偏好制定详细的膳食计划。请用中文回答，提供具体的一周食谱，包括每餐的菜品、食材分量、烹饪建议和营养分析。'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          },
          {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          },
        ),
      );
      return (response as any).data?.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      this.logger.error(`Moonshot 生成食谱失败: ${error.message}`);
      if (error.response?.status === 401) {
        this.logger.error('Moonshot API Key 无效或已过期，请检查 .env 文件中的 MOONSHOT_API_KEY');
      }
      if (error.response?.data) {
        this.logger.error('错误详情:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  async streamChat(messages: any[], onDelta: (delta: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const axios = require('axios');
      
      axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.config.get('app.ai.moonshot.model'),
          messages,
          stream: true,
        },
        {
          headers: { 
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'text/event-stream',
          },
          responseType: 'stream',
        },
      ).then((response: any) => {
        const stream = response.data;
        let buffer = '';
        
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') {
              resolve();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                onDelta(delta);
              }
              
              // 检查是否完成
              if (parsed.choices?.[0]?.finish_reason === 'stop') {
                resolve();
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        });
        
        stream.on('end', () => {
          resolve();
        });
        
        stream.on('error', (error: any) => {
          this.logger.error('SSE 流错误:', error);
          reject(error);
        });
      }).catch((error: any) => {
        this.logger.error('发起流式请求失败:', error);
        reject(error);
      });
    });
  }
}