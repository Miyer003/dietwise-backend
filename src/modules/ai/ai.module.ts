import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIController } from './ai.controller';
import { AILogService } from './ai-log.service';
import { DietModule } from '../diet/diet.module';
import { TipsModule } from '../tips/tips.module';
import { UserModule } from '../user/user.module';
import { MealPlanModule } from '../meal-plan/meal-plan.module';
import { AIModule as SharedAIModule } from '../../shared/ai/ai.module';
import { ChatModule } from '../chat/chat.module';
import { AICallLog } from './entities/ai-call-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AICallLog]),
    SharedAIModule,
    DietModule,
    TipsModule,
    UserModule,
    MealPlanModule,
    ChatModule,
  ],
  controllers: [AIController],
  providers: [AILogService],
})
export class AIModule {}
