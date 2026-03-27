import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { UserAchievement } from './entities/user-achievement.entity';
import { BadgeDefinition } from '../badge/entities/badge-definition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserAchievement, BadgeDefinition])],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
