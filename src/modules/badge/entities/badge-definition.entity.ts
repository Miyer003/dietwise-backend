import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('badge_definitions')
@Index(['category', 'isActive'])
export class BadgeDefinition extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true, name: 'badge_code' })
  badgeCode: string;

  @Column({ type: 'varchar', length: 100, name: 'badge_name' })
  badgeName: string;

  @Column({ type: 'varchar', length: 200, name: 'badge_desc', nullable: true })
  badgeDesc: string;

  @Column({ type: 'varchar', length: 10, name: 'icon_emoji', default: '🏆' })
  iconEmoji: string;

  @Column({ type: 'varchar', length: 7, name: 'icon_color', default: '#F59E0B' })
  iconColor: string;

  @Column({ type: 'varchar', length: 20 })
  category: string; // continuous(连续) / balanced(均衡) / habit(习惯)

  @Column({ type: 'varchar', length: 30, name: 'condition_type' })
  conditionType: string; // streak_days / balanced_days / photo_count / etc

  @Column({ type: 'integer', name: 'condition_value' })
  conditionValue: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'smallint', name: 'sort_order', default: 0 })
  sortOrder: number;
}

// 默认徽章数据
export const DEFAULT_BADGES = [
  { badgeCode: 'first_record', badgeName: '初次记录', badgeDesc: '完成首次饮食记录', iconEmoji: '📝', iconColor: '#6366F1', category: 'habit', conditionType: 'record_count', conditionValue: 1, sortOrder: 1 },
  { badgeCode: 'streak_3', badgeName: '连续3天', badgeDesc: '坚持记录3天', iconEmoji: '🔥', iconColor: '#F59E0B', category: 'continuous', conditionType: 'streak_days', conditionValue: 3, sortOrder: 2 },
  { badgeCode: 'streak_7', badgeName: '连续7天', badgeDesc: '坚持记录7天', iconEmoji: '🔥', iconColor: '#F97316', category: 'continuous', conditionType: 'streak_days', conditionValue: 7, sortOrder: 3 },
  { badgeCode: 'streak_30', badgeName: '连续30天', badgeDesc: '坚持记录30天', iconEmoji: '🔥', iconColor: '#EF4444', category: 'continuous', conditionType: 'streak_days', conditionValue: 30, sortOrder: 4 },
  { badgeCode: 'balanced_diet', badgeName: '营养均衡', badgeDesc: '连续3天营养均衡', iconEmoji: '⚖️', iconColor: '#10B981', category: 'balanced', conditionType: 'balanced_days', conditionValue: 3, sortOrder: 5 },
  { badgeCode: 'sugar_control', badgeName: '控糖达人', badgeDesc: '连续7天控糖', iconEmoji: '🍬', iconColor: '#3B82F6', category: 'balanced', conditionType: 'sugar_control_days', conditionValue: 7, sortOrder: 6 },
  { badgeCode: 'calorie_perfect', badgeName: '热量达标', badgeDesc: '连续5天热量达标', iconEmoji: '🎯', iconColor: '#8B5CF6', category: 'balanced', conditionType: 'calorie_perfect_days', conditionValue: 5, sortOrder: 7 },
  { badgeCode: 'photo_master', badgeName: '拍照大师', badgeDesc: '拍照识别20次', iconEmoji: '📸', iconColor: '#EC4899', category: 'habit', conditionType: 'photo_count', conditionValue: 20, sortOrder: 8 },
  { badgeCode: 'chat_enthusiast', badgeName: '咨询达人', badgeDesc: 'AI咨询10次', iconEmoji: '💬', iconColor: '#14B8A6', category: 'habit', conditionType: 'chat_count', conditionValue: 10, sortOrder: 9 },
];
