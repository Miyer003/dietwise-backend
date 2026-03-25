import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadgeController } from './badge.controller';
import { BadgeService } from './badge.service';
import { BadgeDefinition } from './entities/badge-definition.entity';
import { UserAchievement } from '../achievement/entities/user-achievement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BadgeDefinition, UserAchievement]),
  ],
  controllers: [BadgeController],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule implements OnModuleInit {
  constructor(private readonly badgeService: BadgeService) {}

  async onModuleInit() {
    // 初始化默认徽章
    await this.badgeService.initDefaultBadges();
  }
}
