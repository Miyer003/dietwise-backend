import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSessionDto, SendMessageDto } from './dto/chat.dto';

@ApiTags('AI咨询')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  @ApiOperation({ summary: '获取历史会话列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getSessions(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getSessions(userId, page || 1, limit || 20);
  }

  @Post('sessions')
  @ApiOperation({ summary: '创建新会话' })
  async createSession(@CurrentUser('userId') userId: string, @Body() dto: CreateSessionDto) {
    return this.chatService.createSession(userId, dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '获取会话消息历史' })
  async getSession(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.chatService.getSession(userId, id);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '删除会话' })
  async deleteSession(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.chatService.deleteSession(userId, id);
    return { message: '会话已删除' };
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '发送消息（非流式）' })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, sessionId, dto);
  }

  @Post('sessions/:id/messages/stream')
  @ApiOperation({ summary: '发送消息（SSE流式）' })
  async sendMessageStream(
    @CurrentUser('userId') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await this.chatService.sendMessageStream(userId, sessionId, dto, {
        onDelta: (delta) => {
          res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
        },
        onComplete: (fullContent) => {
          res.write(`data: ${JSON.stringify({ type: 'complete', content: fullContent })}\n\n`);
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          res.end();
        },
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
}
