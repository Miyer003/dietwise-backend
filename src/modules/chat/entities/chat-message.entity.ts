import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatSession } from './chat-session.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('chat_messages')
@Index(['sessionId', 'createdAt'])
export class ChatMessage extends BaseEntity {
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => ChatSession, session => session.messages)
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, name: 'ai_provider', nullable: true })
  aiProvider: string | null;

  @Column({ type: 'integer', name: 'prompt_tokens', nullable: true })
  promptTokens: number | null;

  @Column({ type: 'integer', name: 'completion_tokens', nullable: true })
  completionTokens: number | null;

  @Column({ type: 'integer', name: 'latency_ms', nullable: true })
  latencyMs: number | null;
}
