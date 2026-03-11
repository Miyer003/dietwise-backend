import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealPlanService } from './meal-plan.service';
import { MealPlanController } from './meal-plan.controller';
import { MealPlan } from './entities/meal-plan.entity';
import { MealPlanDay } from './entities/meal-plan-day.entity';
import { AIModule } from '../../shared/ai/ai.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([MealPlan, MealPlanDay]), AIModule, UserModule],
  controllers: [MealPlanController],
  providers: [MealPlanService],
  exports: [MealPlanService],
})
export class MealPlanModule {}
