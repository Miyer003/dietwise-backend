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
    } catch (error) {
      this.logger.error(`Moonshot 生成食谱失败: ${error.message}`);
      throw error;
    }
  }

  async streamChat(messages: any[], onDelta: (delta: string) => void): Promise<void> {
    // 实现 SSE 流式对话
    const response = await lastValueFrom(
      this.http.post(
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
      ),
    );
    
    // 处理流式响应...
    // 实际实现需要处理 Node.js stream
  }
}