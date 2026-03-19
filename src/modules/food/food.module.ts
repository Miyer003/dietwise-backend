import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodService } from './food.service';
import { FoodController } from './food.controller';
import { FoodItem } from './entities/food-item.entity';
import { DietRecordItem } from '../diet/entities/diet-record-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FoodItem, DietRecordItem])],
  controllers: [FoodController],
  providers: [FoodService],
  exports: [FoodService],
})
export class FoodModule {}
