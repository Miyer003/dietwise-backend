import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum ColorTheme {
  PINK = 'pink',
  GREEN = 'green',
  BLUE = 'blue',
  ORANGE = 'orange',
  PURPLE = 'purple',
}

@Entity('user_tips')
@Index(['userId', 'isActive'])
export class UserTip extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  content: string;

  @Column({ type: 'enum', enum: ColorTheme, default: ColorTheme.GREEN })
  colorTheme: ColorTheme;

  @Column({ type: 'smallint', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'smallint', name: 'display_weight', default: 1 })
  displayWeight: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
