import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DietService } from './diet.service';
import { DietController } from './diet.controller';
import { DietRecord } from './entities/diet-record.entity';
import { DietRecordItem } from './entities/diet-record-item.entity';
import { MealPlan } from '../meal-plan/entities/meal-plan.entity';
import { AIModule } from '../../shared/ai/ai.module';
import { UserModule } from '../user/user.module';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [TypeOrmModule.forFeature([DietRecord, DietRecordItem, MealPlan]), AIModule, UserModule, AchievementModule],
  controllers: [DietController],
  providers: [DietService],
  exports: [DietService],
})
export class DietModule {}
