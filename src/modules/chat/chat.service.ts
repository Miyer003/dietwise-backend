import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ChatSession, ContextSnapshot } from './entities/chat-session.entity';
import { ChatMessage, MessageRole } from './entities/chat-message.entity';
import { CreateSessionDto, SendMessageDto } from './dto/chat.dto';
import { AIService } from '../../shared/ai/ai.service';
import { DietService } from '../diet/diet.service';

interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly aiService: AIService,
    private readonly dietService: DietService,
  ) {}

  // 获取会话列表
  async getSessions(userId: string, page: number = 1, limit: number = 20) {
    const [sessions, total] = await this.sessionRepo.findAndCount({
      where: { userId, deletedAt: null as any },
      order: { lastMessageAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: sessions.map(session => ({
        id: session.id,
        title: session.title,
        messageCount: session.messageCount,
        lastMessageAt: session.lastMessageAt,
        createdAt: session.createdAt,
      })),
    };
  }

  // 创建新会话
  async createSession(userId: string, dto: CreateSessionDto) {
    // 获取今日摄入快照
    const today = new Date().toISOString().split('T')[0];
    const dailySummary = await this.dietService.getDailySummary(userId, today);

    const contextSnapshot: ContextSnapshot = {
      date: today,
      calorieGoal: dailySummary.calorieGoal,
      calorieConsumed: dailySummary.calorieConsumed,
      calorieRemaining: dailySummary.calorieRemaining,
      mealCount: dailySummary.mealRecords?.length || 0,
    };

    const session = this.sessionRepo.create({
      userId,
      title: dto.title || `咨询 ${new Date().toLocaleString('zh-CN')}`,
      contextSnapshot,
      messageCount: 0,
    });

    return this.sessionRepo.save(session);
  }

  // 获取会话详情及消息
  async getSession(userId: string, id: string) {
    const session = await this.sessionRepo.findOne({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('无权访问此会话');
    }

    const messages = await this.messageRepo.find({
      where: { sessionId: id },
      order: { createdAt: 'ASC' },
    });

    return {
      id: session.id,
      title: session.title,
      contextSnapshot: session.contextSnapshot,
      createdAt: session.createdAt,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    };
  }

  // 删除会话（软删除）
  async deleteSession(userId: string, id: string) {
    const session = await this.sessionRepo.findOne({ where: { id } });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('无权删除此会话');
    }

    await this.sessionRepo.update(id, { deletedAt: new Date() });
  }

  // 发送消息（非流式）
  async sendMessage(userId: string, sessionId: string, dto: SendMessageDto) {
    const session = await this.getSession(userId, sessionId);

    // 保存用户消息
    const userMessage = this.messageRepo.create({
      sessionId,
      userId,
      role: MessageRole.USER,
      content: dto.message,
    });
    await this.messageRepo.save(userMessage);

    // 构建对话历史
    const history = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 添加上下文提示
    const contextPrompt = this.buildContextPrompt(session.contextSnapshot!);
    const messages = [
      { role: 'user' as const, content: contextPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: dto.message },
    ];

    // 调用AI
    const startTime = Date.now();
    const aiResponse = await this.aiService.chat(messages);
    const latency = Date.now() - startTime;

    // 保存AI回复
    const assistantMessage = this.messageRepo.create({
      sessionId,
      userId,
      role: MessageRole.ASSISTANT,
      content: aiResponse,
      aiProvider: 'qwen-turbo',
      latencyMs: latency,
    });
    await this.messageRepo.save(assistantMessage);

    // 更新会话统计
    await this.sessionRepo.update(sessionId, {
      messageCount: session.messages.length + 2,
      lastMessageAt: new Date(),
    });

    return {
      message: assistantMessage,
    };
  }

  // 发送消息（流式）
  async sendMessageStream(
    userId: string,
    sessionId: string,
    dto: SendMessageDto,
    callbacks: StreamCallbacks,
  ) {
    const session = await this.getSession(userId, sessionId);

    // 保存用户消息
    const userMessage = this.messageRepo.create({
      sessionId,
      userId,
      role: MessageRole.USER,
      content: dto.message,
    });
    await this.messageRepo.save(userMessage);

    // 构建对话历史
    const history = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const contextPrompt = this.buildContextPrompt(session.contextSnapshot!);
    const messages = [
      { role: 'user' as const, content: contextPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: dto.message },
    ];

    // 调用AI流式接口
    let fullContent = '';
    const startTime = Date.now();

    try {
      // TODO: 实现真正的流式调用
      // 这里先用非流式模拟
      const aiResponse = await this.aiService.chat(messages);
      fullContent = aiResponse;

      // 模拟流式输出
      const chunks = aiResponse.split('');
      for (const chunk of chunks) {
        callbacks.onDelta(chunk);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      callbacks.onComplete(fullContent);
    } catch (error) {
      callbacks.onError(error);
      return;
    }

    const latency = Date.now() - startTime;

    // 保存AI回复
    const assistantMessage = this.messageRepo.create({
      sessionId,
      userId,
      role: MessageRole.ASSISTANT,
      content: fullContent,
      aiProvider: 'qwen-turbo',
      latencyMs: latency,
    });
    await this.messageRepo.save(assistantMessage);

    // 更新会话统计
    await this.sessionRepo.update(sessionId, {
      messageCount: session.messages.length + 2,
      lastMessageAt: new Date(),
    });
  }

  // 构建上下文提示
  private buildContextPrompt(snapshot: ContextSnapshot): string {
    return `你是膳智AI营养顾问，一位专业的营养师。请基于用户的今日饮食数据提供个性化的营养建议。

用户今日摄入情况：
- 热量目标：${snapshot.calorieGoal} kcal
- 已摄入：${snapshot.calorieConsumed} kcal
- 剩余：${snapshot.calorieRemaining} kcal
- 已记录餐次：${snapshot.mealCount} 餐

请以专业、友好的语气回答用户的问题，必要时结合今日数据给出具体建议。`;
  }
}
