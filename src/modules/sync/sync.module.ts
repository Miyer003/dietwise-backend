import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { DietModule } from '../diet/diet.module';
import { MealPlanModule } from '../meal-plan/meal-plan.module';

import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [DietModule, MealPlanModule, AchievementModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
