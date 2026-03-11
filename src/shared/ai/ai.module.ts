import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DashscopeService } from './dashscope.service';
import { MoonshotService } from './moonshot.service';
import { AIService } from './ai.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [DashscopeService, MoonshotService, AIService],
  exports: [AIService],
})
export class AIModule {}