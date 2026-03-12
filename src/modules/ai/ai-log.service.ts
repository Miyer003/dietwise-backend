import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AICallLog, AIFunctionType, AIProvider } from './entities/ai-call-log.entity';

// 重新导出供其他模块使用
export { AIFunctionType, AIProvider };

export interface CreateLogDto {
  userId: string;
  functionType: AIFunctionType;
  provider?: AIProvider;
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AILogService {
  // 简单定价模型（每1000 tokens 的价格，单位：分）
  private readonly pricing = {
    [AIProvider.DASHSCOPE]: {
      'qwen-vl-plus': { input: 8, output: 8 },
      'qwen-turbo': { input: 2, output: 6 },
      'qwen-plus': { input: 4, output: 12 },
      default: { input: 4, output: 8 },
    },
    [AIProvider.MOONSHOT]: {
      'moonshot-v1-8k': { input: 6, output: 6 },
      'moonshot-v1-32k': { input: 12, output: 12 },
      default: { input: 6, output: 6 },
    },
  };

  constructor(
    @InjectRepository(AICallLog)
    private readonly logRepo: Repository<AICallLog>,
  ) {}

  // 创建调用日志
  async createLog(dto: CreateLogDto): Promise<AICallLog> {
    const costCents = this.calculateCost(
      dto.provider,
      dto.modelName,
      dto.inputTokens || 0,
      dto.outputTokens || 0,
    );

    const log = this.logRepo.create({
      ...dto,
      costCents,
    });

    return this.logRepo.save(log);
  }

  // 获取用户当月使用统计
  async getMonthlyStats(userId: string, yearMonth?: string) {
    const targetMonth = yearMonth || new Date().toISOString().slice(0, 7);
    const startDate = new Date(`${targetMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const logs = await this.logRepo.find({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
        success: true,
      },
    });

    const stats = {
      month: targetMonth,
      callCount: logs.length,
      estimatedCost: logs.reduce((sum, log) => sum + Number(log.costCents), 0) / 100, // 转换为元
      byFunction: {} as Record<AIFunctionType, number>,
      byProvider: {} as Record<AIProvider, number>,
      totalTokens: {
        input: logs.reduce((sum, log) => sum + (log.inputTokens || 0), 0),
        output: logs.reduce((sum, log) => sum + (log.outputTokens || 0), 0),
      },
    };

    // 按功能类型统计
    for (const log of logs) {
      if (!stats.byFunction[log.functionType]) {
        stats.byFunction[log.functionType] = 0;
      }
      stats.byFunction[log.functionType]++;

      if (log.provider) {
        if (!stats.byProvider[log.provider]) {
          stats.byProvider[log.provider] = 0;
        }
        stats.byProvider[log.provider]++;
      }
    }

    return stats;
  }

  // 计算调用成本（单位：分）
  private calculateCost(
    provider?: AIProvider,
    modelName?: string,
    inputTokens: number = 0,
    outputTokens: number = 0,
  ): number {
    if (!provider) return 0;

    const providerPricing = this.pricing[provider];
    if (!providerPricing) return 0;

    const modelKey = (modelName || 'default') as keyof typeof providerPricing;
    const modelPricing = providerPricing[modelKey] || providerPricing.default;

    const inputCost = (inputTokens / 1000) * modelPricing.input;
    const outputCost = (outputTokens / 1000) * modelPricing.output;

    return Math.round((inputCost + outputCost) * 100) / 100; // 保留两位小数
  }
}
