import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DietRecord } from './diet-record.entity';

@Entity('diet_record_items')
export class DietRecordItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'record_id' })
  recordId: string;

  @ManyToOne(() => DietRecord, record => record.items)
  @JoinColumn({ name: 'record_id' })
  record: DietRecord;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'food_item_id', nullable: true })
  foodItemId: string;

  @Column({ type: 'varchar', length: 100, name: 'food_name' })
  foodName: string;

  @Column({ type: 'decimal', precision: 8, scale: 1, name: 'quantity_g' })
  quantityG: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, name: 'portion_factor', default: 1.0 })
  portionFactor: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  calories: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'protein_g' })
  proteinG: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'carbs_g' })
  carbsG: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'fat_g' })
  fatG: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'fiber_g', default: 0 })
  fiberG: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'sodium_mg', default: 0 })
  sodiumMg: number;

  @Column({ type: 'text', name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ type: 'varchar', length: 64, name: 'image_hash', nullable: true })
  imageHash: string;

  @Column({ type: 'varchar', length: 20, name: 'ai_provider', nullable: true })
  aiProvider: string;

  @Column({ type: 'jsonb', name: 'ai_raw_response', nullable: true })
  aiRawResponse: any;

  @Column({ type: 'decimal', precision: 4, scale: 3, name: 'ai_confidence', nullable: true })
  aiConfidence: number;
}