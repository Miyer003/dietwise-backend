import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('notification_settings')
export class NotificationSetting {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'boolean', name: 'master_enabled', default: true })
  masterEnabled: boolean;

  // 餐次提醒
  @Column({ type: 'boolean', name: 'breakfast_enabled', default: true })
  breakfastEnabled: boolean;

  @Column({ type: 'time', name: 'breakfast_time', default: '07:30' })
  breakfastTime: string;

  @Column({ type: 'boolean', name: 'lunch_enabled', default: true })
  lunchEnabled: boolean;

  @Column({ type: 'time', name: 'lunch_time', default: '12:00' })
  lunchTime: string;

  @Column({ type: 'boolean', name: 'dinner_enabled', default: true })
  dinnerEnabled: boolean;

  @Column({ type: 'time', name: 'dinner_time', default: '18:00' })
  dinnerTime: string;

  // 饮水提醒
  @Column({ type: 'boolean', name: 'water_enabled', default: true })
  waterEnabled: boolean;

  @Column({ type: 'smallint', name: 'water_interval_h', default: 2 })
  waterIntervalH: number;

  @Column({ type: 'time', name: 'water_start_time', default: '08:00' })
  waterStartTime: string;

  @Column({ type: 'time', name: 'water_end_time', default: '22:00' })
  waterEndTime: string;

  // 其他提醒
  @Column({ type: 'boolean', name: 'record_remind', default: true })
  recordRemind: boolean;

  @Column({ type: 'boolean', name: 'bedtime_remind', default: true })
  bedtimeRemind: boolean;

  @Column({ type: 'time', name: 'bedtime_time', default: '21:30' })
  bedtimeTime: string;

  // Expo推送Token
  @Column({ type: 'text', name: 'expo_push_token', nullable: true })
  expoPushToken: string;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
