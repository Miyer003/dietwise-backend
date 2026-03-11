import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { RedisModule } from './shared/redis/redis.module';
import { MinioModule } from './shared/minio/minio.module';
import { AIModule } from './shared/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DietModule } from './modules/diet/diet.module';
import { FoodModule } from './modules/food/food.module';
import { MealPlanModule } from './modules/meal-plan/meal-plan.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TipsModule } from './modules/tips/tips.module';
import { ChatModule } from './modules/chat/chat.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { AdminModule } from './modules/admin/admin.module';
import { SyncModule } from './modules/sync/sync.module';
import { AIController } from './modules/ai/ai.controller';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('app.database.host'),
        port: config.get('app.database.port'),
        username: config.get('app.database.username'),
        password: config.get('app.database.password'),
        database: config.get('app.database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('app.database.synchronize'),
        logging: config.get('app.nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    MinioModule,
    AIModule,
    AuthModule,
    UserModule,
    DietModule,
    FoodModule,
    MealPlanModule,
    NotificationModule,
    TipsModule,
    ChatModule,
    AchievementModule,
    FeedbackModule,
    AdminModule,
    SyncModule,
  ],
  controllers: [AIController],
  providers: [
    // 全局JWT认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
