import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum AIFunctionType {
  NUTRITION_ANALYSIS = 'nutrition_analysis',
  VOICE_ANALYSIS = 'voice_analysis',
  CHAT = 'chat',
  MEAL_PLAN_GENERATION = 'meal_plan_generation',
  TIP_GENERATION = 'tip_generation',
}

export enum AIProvider {
  DASHSCOPE = 'dashscope',
  MOONSHOT = 'moonshot',
}

@Entity('ai_call_logs')
export class AICallLog extends BaseEntity {
  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({
    name: 'function_type',
    type: 'enum',
    enum: AIFunctionType,
  })
  functionType: AIFunctionType;

  @Column({
    name: 'provider',
    type: 'enum',
    enum: AIProvider,
    nullable: true,
  })
  provider: AIProvider;

  @Column({ name: 'model_name', nullable: true })
  modelName: string;

  @Column({ name: 'input_tokens', nullable: true })
  inputTokens: number;

  @Column({ name: 'output_tokens', nullable: true })
  outputTokens: number;

  @Column({ name: 'latency_ms', nullable: true })
  latencyMs: number;

  @Column({ name: 'cost_cents', type: 'decimal', precision: 10, scale: 4, default: 0 })
  costCents: number;

  @Column({ name: 'success', default: true })
  success: boolean;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;
}
