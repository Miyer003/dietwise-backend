import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_sessions')
@Index(['userId', 'deletedAt'])
export class ChatSession extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title: string;

  @Column({ type: 'jsonb', name: 'context_snapshot', nullable: true })
  contextSnapshot: ContextSnapshot | null;

  @Column({ type: 'integer', name: 'message_count', default: 0 })
  messageCount: number;

  @Column({ type: 'timestamptz', name: 'last_message_at', nullable: true })
  lastMessageAt: Date | null;

  // 软删除字段 - 继承自BaseEntity但允许null

  @OneToMany(() => ChatMessage, message => message.session)
  messages: ChatMessage[];
}

export interface ContextSnapshot {
  date: string;
  calorieGoal: number;
  calorieConsumed: number;
  calorieRemaining: number;
  mealCount: number;
}
