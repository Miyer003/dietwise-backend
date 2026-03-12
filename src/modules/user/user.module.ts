import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { DietRecord } from '../diet/entities/diet-record.entity';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, DietRecord]),
    AchievementModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
