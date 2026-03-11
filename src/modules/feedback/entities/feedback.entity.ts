import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum FeedbackType {
  BUG = 'bug',
  FEATURE = 'feature',
  DATA_ERROR = 'data_error',
  OTHER = 'other',
}

export enum FeedbackStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity('feedbacks')
@Index(['status', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Feedback extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: FeedbackType })
  type: FeedbackType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 100, name: 'contact_info', nullable: true })
  contactInfo: string | null;

  @Column({ type: 'simple-array', default: '' })
  screenshots: string[];

  @Column({ type: 'enum', enum: FeedbackStatus, default: FeedbackStatus.PENDING })
  status: FeedbackStatus;

  @Column({ type: 'uuid', name: 'admin_id', nullable: true })
  adminId: string | null;

  @Column({ type: 'text', name: 'admin_reply', nullable: true })
  adminReply: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;
}
