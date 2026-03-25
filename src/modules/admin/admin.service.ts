import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThanOrEqual } from 'typeorm';
import { User, UserStatus } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { DietRecord } from '../diet/entities/diet-record.entity';
import { FoodItem } from '../food/entities/food-item.entity';
import { AICallLog } from '../ai/entities/ai-call-log.entity';
import { Feedback, FeedbackStatus } from '../feedback/entities/feedback.entity';
import { UserAchievement } from '../achievement/entities/user-achievement.entity';
import { UpdateUserStatusDto, UserListQueryDto, DateRangeQueryDto, UpdateFeedbackDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(DietRecord)
    private readonly dietRecordRepo: Repository<DietRecord>,
    @InjectRepository(FoodItem)
    private readonly foodRepo: Repository<FoodItem>,
    @InjectRepository(AICallLog)
    private readonly aiLogRepo: Repository<AICallLog>,
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(UserAchievement)
    private readonly achievementRepo: Repository<UserAchievement>,
  ) {}

  // ==================== Dashboard ====================

  // 获取今天的开始和结束时间（UTC）
  private getTodayRange() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return {
      start: new Date(`${todayStr}T00:00:00.000Z`),
      end: new Date(`${todayStr}T23:59:59.999Z`),
    };
  }

  // 获取指定日期的开始和结束时间（UTC）
  private getDateRange(daysAgo: number) {
    const now = new Date();
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];
    return {
      start: new Date(`${dateStr}T00:00:00.000Z`),
      end: new Date(`${dateStr}T23:59:59.999Z`),
    };
  }

  // 获取核心指标概览
  async getDashboardOverview() {
    const { start, end } = this.getTodayRange();

    // 总用户数
    const totalUsers = await this.userRepo.count();

    // 今日新增用户
    const todayNewUsers = await this.userRepo.count({
      where: {
        createdAt: Between(start, end),
      },
    });

    // 今日活跃（有饮食记录的用户）
    const todayActiveUsersQuery = await this.dietRecordRepo
      .createQueryBuilder('record')
      .select('COUNT(DISTINCT record.user_id)', 'count')
      .where('record.createdAt >= :start', { start })
      .andWhere('record.createdAt <= :end', { end })
      .getRawOne();
    const todayActiveUsers = parseInt(todayActiveUsersQuery?.count || '0');

    // 今日记录数
    const todayRecords = await this.dietRecordRepo.count({
      where: {
        createdAt: Between(start, end),
      },
    });

    // 今日AI调用
    const todayAICalls = await this.aiLogRepo.count({
      where: {
        createdAt: Between(start, end),
      },
    });

    // 今日AI费用（分转元）
    const aiCostResult = await this.aiLogRepo
      .createQueryBuilder('log')
      .select('SUM(log.costCents)', 'total')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .getRawOne();
    const todayAICost = Math.round((parseFloat(aiCostResult?.total || '0')) / 100);

    // 待处理反馈
    const pendingFeedbacks = await this.feedbackRepo.count({
      where: { status: FeedbackStatus.PENDING },
    });

    return {
      totalUsers,
      todayActiveUsers,
      todayNewUsers,
      todayRecords,
      todayAICalls,
      todayAICost,
      pendingFeedbacks,
    };
  }

  // 用户增长趋势
  async getUserGrowthTrend(days: number = 30) {
    const dates: string[] = [];
    const newUsers: number[] = [];
    const activeUsers: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const { start, end } = this.getDateRange(i);
      const dateStr = start.toISOString().split('T')[0];
      dates.push(dateStr);

      // 新增用户
      const newCount = await this.userRepo.count({
        where: {
          createdAt: Between(start, end),
        },
      });
      newUsers.push(newCount);

      // 活跃用户
      const activeQuery = await this.dietRecordRepo
        .createQueryBuilder('record')
        .select('COUNT(DISTINCT record.user_id)', 'count')
        .where('record.createdAt >= :start', { start })
        .andWhere('record.createdAt <= :end', { end })
        .getRawOne();
      activeUsers.push(parseInt(activeQuery?.count || '0'));
    }

    return { dates, newUsers, activeUsers };
  }

  // AI使用趋势
  async getAIUsageTrend(days: number = 30) {
    const dates: string[] = [];
    const callCounts: number[] = [];
    const costs: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const { start, end } = this.getDateRange(i);
      const dateStr = start.toISOString().split('T')[0];
      dates.push(dateStr);

      const callCount = await this.aiLogRepo.count({
        where: {
          createdAt: Between(start, end),
        },
      });
      callCounts.push(callCount);

      const costResult = await this.aiLogRepo
        .createQueryBuilder('log')
        .select('SUM(log.costCents)', 'total')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getRawOne();
      costs.push(Math.round((parseFloat(costResult?.total || '0')) / 100));
    }

    return { dates, callCounts, costs };
  }

  // ==================== 用户管理 ====================

  // 获取用户列表
  async getUsers(query: UserListQueryDto) {
    const { keyword, status, page = 1, limit = 20 } = query;
    
    let where: any = {};
    if (keyword) {
      // 同时搜索昵称和手机号
      if (/^\d+$/.test(keyword)) {
        // 纯数字搜索手机号
        where = [
          { phone: Like(`%${keyword}%`) },
          { nickname: Like(`%${keyword}%`) },
        ];
      } else {
        // 非数字只搜索昵称
        where.nickname = Like(`%${keyword}%`);
      }
    }
    if (status) {
      where.status = status;
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: users.map(user => ({
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatarEmoji: user.avatarEmoji,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      })),
    };
  }

  // 获取用户详情
  async getUserDetail(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 统计信息
    const totalRecords = await this.dietRecordRepo.count({
      where: { userId: id },
    });

    const totalAchievements = await this.achievementRepo.count({
      where: { userId: id },
    });

    const aiUsage = await this.aiLogRepo.count({
      where: { userId: id },
    });

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      nickname: user.nickname,
      avatarEmoji: user.avatarEmoji,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
      stats: {
        totalRecords,
        totalAchievements,
        aiUsage,
      },
    };
  }

  // 更新用户状态
  async updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.status = dto.status;
    await this.userRepo.save(user);

    return { success: true };
  }

  // 获取用户饮食记录
  async getUserRecords(userId: string, page = 1, limit = 20) {
    const [records, total] = await this.dietRecordRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: records,
    };
  }

  // 获取用户成就
  async getUserAchievements(userId: string) {
    return this.achievementRepo.find({
      where: { userId },
      order: { unlockedAt: 'DESC' },
    });
  }

  // ==================== 食物库管理 ====================

  // 获取食物列表
  async getFoods(keyword?: string, category?: string, page = 1, limit = 20) {
    const where: any = {};
    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }
    if (category) {
      where.category = category;
    }

    const [foods, total] = await this.foodRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: foods,
    };
  }

  // 获取食物分类
  async getFoodCategories() {
    const categories = await this.foodRepo
      .createQueryBuilder('food')
      .select('DISTINCT food.category', 'category')
      .getRawMany();
    
    return categories.map(c => c.category);
  }

  // 获取食物详情
  async getFoodDetail(id: string) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException('食物不存在');
    }
    return food;
  }

  // 创建食物
  async createFood(data: Partial<FoodItem>) {
    const food = this.foodRepo.create(data);
    return this.foodRepo.save(food);
  }

  // 更新食物
  async updateFood(id: string, data: Partial<FoodItem>) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException('食物不存在');
    }
    Object.assign(food, data);
    return this.foodRepo.save(food);
  }

  // 删除食物
  async deleteFood(id: string) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException('食物不存在');
    }
    await this.foodRepo.remove(food);
    return { success: true };
  }

  // ==================== AI监控 ====================

  // 获取AI统计（按日期范围）
  async getAIStats(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    const start = startDate ? new Date(startDate) : this.getDateRange(30).start;
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await this.aiLogRepo
      .createQueryBuilder('log')
      .select('DATE(log.createdAt)', 'date')
      .addSelect('COUNT(*)', 'calls')
      .addSelect('SUM(log.costCents)', 'cost')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .groupBy('DATE(log.createdAt)')
      .orderBy('date', 'DESC')
      .getRawMany();

    return stats;
  }

  // 获取AI统计按服务商
  async getAIStatsByProvider(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    const start = startDate ? new Date(startDate) : this.getDateRange(30).start;
    const end = endDate ? new Date(endDate) : new Date();

    return this.aiLogRepo
      .createQueryBuilder('log')
      .select('log.provider', 'provider')
      .addSelect('COUNT(*)', 'calls')
      .addSelect('SUM(log.costCents)', 'cost')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .groupBy('log.provider')
      .getRawMany();
  }

  // 获取AI统计按功能
  async getAIStatsByFunction(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    const start = startDate ? new Date(startDate) : this.getDateRange(30).start;
    const end = endDate ? new Date(endDate) : new Date();

    return this.aiLogRepo
      .createQueryBuilder('log')
      .select('log.functionType', 'functionType')
      .addSelect('COUNT(*)', 'calls')
      .addSelect('SUM(log.costCents)', 'cost')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .groupBy('log.functionType')
      .getRawMany();
  }

  // 获取AI调用日志
  async getAILogs(query: { page?: number; limit?: number; userId?: string; startDate?: string; endDate?: string }) {
    const { page = 1, limit = 20, userId, startDate, endDate } = query;
    
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const [logs, total] = await this.aiLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      items: logs,
    };
  }

  // ==================== 反馈管理 ====================

  // 获取反馈列表
  async getFeedbacks(status?: FeedbackStatus, page = 1, limit = 20) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [feedbacks, total] = await this.feedbackRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['user'],
    });

    return {
      total,
      page,
      limit,
      items: feedbacks.map(f => ({
        id: f.id,
        userId: f.userId,
        content: f.content,
        status: f.status,
        createdAt: f.createdAt,
        user: f.user ? {
          nickname: f.user.nickname,
          phone: f.user.phone,
        } : null,
      })),
    };
  }

  // 获取反馈详情
  async getFeedbackDetail(id: string) {
    const feedback = await this.feedbackRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!feedback) {
      throw new NotFoundException('反馈不存在');
    }
    return {
      ...feedback,
      user: feedback.user ? {
        nickname: feedback.user.nickname,
        phone: feedback.user.phone,
      } : null,
    };
  }

  // 更新反馈状态
  async updateFeedback(id: string, dto: UpdateFeedbackDto) {
    const feedback = await this.feedbackRepo.findOne({ where: { id } });
    if (!feedback) {
      throw new NotFoundException('反馈不存在');
    }

    if (dto.adminReply !== undefined) {
      feedback.adminReply = dto.adminReply;
    }

    await this.feedbackRepo.save(feedback);
    return { success: true };
  }
}
