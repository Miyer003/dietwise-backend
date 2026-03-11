import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, FeedbackStatus } from './entities/feedback.entity';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
  ) {}

  // 创建反馈
  async create(userId: string, dto: CreateFeedbackDto) {
    const feedback = this.feedbackRepo.create({
      userId,
      type: dto.type,
      content: dto.content,
      contactInfo: dto.contactInfo,
      screenshots: dto.screenshots || [],
    });

    return this.feedbackRepo.save(feedback);
  }

  // 获取用户的反馈列表
  async getByUser(userId: string) {
    const feedbacks = await this.feedbackRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return feedbacks.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content,
      status: f.status,
      adminReply: f.adminReply,
      createdAt: f.createdAt,
    }));
  }

  // 获取反馈列表（管理员）
  async getList(status?: string, page: number = 1, limit: number = 20) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [feedbacks, total] = await this.feedbackRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: feedbacks,
    };
  }

  // 获取反馈详情
  async getById(id: string) {
    const feedback = await this.feedbackRepo.findOne({ where: { id } });

    if (!feedback) {
      throw new NotFoundException('反馈不存在');
    }

    return feedback;
  }

  // 更新反馈状态（管理员）
  async updateStatus(id: string, dto: UpdateFeedbackStatusDto, adminId: string) {
    const feedback = await this.getById(id);

    feedback.status = dto.status as FeedbackStatus;
    feedback.adminId = adminId;
    
    if (dto.adminReply !== undefined) {
      feedback.adminReply = dto.adminReply;
    }

    if (dto.status === 'resolved' || dto.status === 'rejected') {
      feedback.resolvedAt = new Date();
    }

    return this.feedbackRepo.save(feedback);
  }
}
