import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { DietRecord } from '../diet/entities/diet-record.entity';
import { DietRecordItem } from '../diet/entities/diet-record-item.entity';
import { FoodItem } from '../food/entities/food-item.entity';
import { AICallLog } from '../ai/entities/ai-call-log.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { UserAchievement } from '../achievement/entities/user-achievement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      DietRecord,
      DietRecordItem,
      FoodItem,
      AICallLog,
      Feedback,
      UserAchievement,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
