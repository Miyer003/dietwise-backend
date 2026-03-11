import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { AIModule } from '../../shared/ai/ai.module';
import { DietModule } from '../diet/diet.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession, ChatMessage]), AIModule, DietModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
