import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { UserAchievement } from './entities/user-achievement.entity';
import { BadgeDefinition } from '../badge/entities/badge-definition.entity';
import { DietRecord } from '../diet/entities/diet-record.entity';
import { DietRecordItem } from '../diet/entities/diet-record-item.entity';
import { AICallLog } from '../ai/entities/ai-call-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserAchievement, BadgeDefinition, DietRecord, DietRecordItem, AICallLog])],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
