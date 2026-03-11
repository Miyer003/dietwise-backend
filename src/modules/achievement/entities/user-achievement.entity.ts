import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('user_achievements')
@Unique(['userId', 'badgeCode'])
@Index(['userId', 'isNew'])
export class UserAchievement extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50, name: 'badge_code' })
  badgeCode: string;

  @Column({ type: 'varchar', length: 100, name: 'badge_name' })
  badgeName: string;

  @Column({ type: 'varchar', length: 200, name: 'badge_desc', nullable: true })
  badgeDesc: string;

  @Column({ type: 'varchar', length: 10, name: 'icon_emoji', default: '🏆' })
  iconEmoji: string;

  @Column({ type: 'varchar', length: 7, name: 'icon_color', default: '#F59E0B' })
  iconColor: string;

  @Column({ type: 'timestamptz', name: 'unlocked_at' })
  unlockedAt: Date;

  @Column({ type: 'boolean', name: 'is_new', default: true })
  isNew: boolean;
}

// 预定义徽章配置
export const BADGE_DEFINITIONS = {
  // 连续记录
  streak_3: { name: '连续3天', desc: '坚持记录3天', icon: '🔥', color: '#F59E0B' },
  streak_7: { name: '连续7天', desc: '坚持记录7天', icon: '🔥', color: '#F97316' },
  streak_30: { name: '连续30天', desc: '坚持记录30天', icon: '🔥', color: '#EF4444' },
  
  // 营养均衡
  balanced_diet: { name: '营养均衡', desc: '连续3天营养均衡', icon: '⚖️', color: '#10B981' },
  sugar_control: { name: '控糖达人', desc: '连续7天控糖', icon: '🍬', color: '#3B82F6' },
  calorie_perfect: { name: '热量达标', desc: '连续5天热量达标', icon: '🎯', color: '#8B5CF6' },
  
  // 使用习惯
  photo_master: { name: '拍照大师', desc: '拍照识别20次', icon: '📸', color: '#EC4899' },
  first_record: { name: '初次记录', desc: '完成首次饮食记录', icon: '📝', color: '#6366F1' },
  chat_enthusiast: { name: '咨询达人', desc: 'AI咨询10次', icon: '💬', color: '#14B8A6' },
};
