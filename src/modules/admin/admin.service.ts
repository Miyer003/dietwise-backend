import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThanOrEqual, In } from 'typeorm';
import { User, UserStatus } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { DietRecord, InputMethod } from '../diet/entities/diet-record.entity';
import { DietRecordItem } from '../diet/entities/diet-record-item.entity';
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
    @InjectRepository(DietRecordItem)
    private readonly dietRecordItemRepo: Repository<DietRecordItem>,
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

  // 获取今天的开始和结束时间（东八区 - 北京时间）
  private getTodayRange() {
    const now = new Date();
    // 转换为北京时间（UTC+8）
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = beijingTime.toISOString().split('T')[0]; // YYYY-MM-DD
    return {
      start: new Date(`${todayStr}T00:00:00.000+08:00`),
      end: new Date(`${todayStr}T23:59:59.999+08:00`),
    };
  }

  // 获取指定日期的开始和结束时间（东八区）
  private getDateRange(daysAgo: number) {
    const now = new Date();
    // 转换为北京时间
    const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const date = new Date(beijingNow);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];
    return {
      start: new Date(`${dateStr}T00:00:00.000+08:00`),
      end: new Date(`${dateStr}T23:59:59.999+08:00`),
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

  // 获取AI统计概览（汇总数据）
  async getAIStats(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    // 将日期字符串解析为北京时间范围
    const start = startDate 
      ? new Date(`${startDate}T00:00:00.000+08:00`) 
      : this.getDateRange(30).start;
    const end = endDate 
      ? new Date(`${endDate}T23:59:59.999+08:00`) 
      : new Date();

    const result = await this.aiLogRepo
      .createQueryBuilder('log')
      .select('COUNT(*)', 'totalCalls')
      .addSelect('SUM(log.costCents)', 'totalCost')
      .addSelect('SUM(CASE WHEN log.success = true THEN 1 ELSE 0 END)', 'successCalls')
      .addSelect('SUM(CASE WHEN log.success = false THEN 1 ELSE 0 END)', 'failedCalls')
      .addSelect('AVG(log.latencyMs)', 'avgLatency')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .getRawOne();

    const totalCalls = parseInt(result?.totalCalls || '0');
    const successCalls = parseInt(result?.successCalls || '0');
    const failedCalls = parseInt(result?.failedCalls || '0');
    const totalCost = Math.round((parseFloat(result?.totalCost || '0')) / 100 * 100) / 100; // 转为元
    const avgLatency = Math.round(parseFloat(result?.avgLatency || '0'));
    const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 1000) / 10 : 0;

    return {
      totalCalls,
      totalCost,
      successCalls,
      failedCalls,
      successRate,
      avgLatency,
    };
  }

  // 获取AI统计按服务商
  async getAIStatsByProvider(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    const start = startDate 
      ? new Date(`${startDate}T00:00:00.000+08:00`) 
      : this.getDateRange(30).start;
    const end = endDate 
      ? new Date(`${endDate}T23:59:59.999+08:00`) 
      : new Date();

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
    
    const start = startDate 
      ? new Date(`${startDate}T00:00:00.000+08:00`) 
      : this.getDateRange(30).start;
    const end = endDate 
      ? new Date(`${endDate}T23:59:59.999+08:00`) 
      : new Date();

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

  // 获取AI统计按模型
  async getAIStatsByModel(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    const start = startDate 
      ? new Date(`${startDate}T00:00:00.000+08:00`) 
      : this.getDateRange(30).start;
    const end = endDate 
      ? new Date(`${endDate}T23:59:59.999+08:00`) 
      : new Date();

    return this.aiLogRepo
      .createQueryBuilder('log')
      .select('log.modelName', 'modelName')
      .addSelect('log.provider', 'provider')
      .addSelect('COUNT(*)', 'calls')
      .addSelect('SUM(log.costCents)', 'cost')
      .addSelect('SUM(log.inputTokens)', 'inputTokens')
      .addSelect('SUM(log.outputTokens)', 'outputTokens')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .andWhere('log.modelName IS NOT NULL')
      .groupBy('log.modelName')
      .addGroupBy('log.provider')
      .orderBy('calls', 'DESC')
      .getRawMany();
  }

  // 获取AI调用趋势（供监控页面使用）
  async getAIUsageTrendForMonitor(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    
    const start = startDate 
      ? new Date(`${startDate}T00:00:00.000+08:00`) 
      : this.getDateRange(30).start;
    const end = endDate 
      ? new Date(`${endDate}T23:59:59.999+08:00`) 
      : new Date();

    // 计算日期差
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const limit = Math.min(daysDiff, 30);

    const stats = await this.aiLogRepo
      .createQueryBuilder('log')
      .select('DATE(log.createdAt)', 'date')
      .addSelect('COUNT(*)', 'calls')
      .addSelect('SUM(log.costCents)', 'cost')
      .addSelect('SUM(CASE WHEN log.success = true THEN 1 ELSE 0 END)', 'successCalls')
      .addSelect('SUM(CASE WHEN log.success = false THEN 1 ELSE 0 END)', 'failCalls')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .groupBy('DATE(log.createdAt)')
      .orderBy('date', 'ASC')
      .limit(limit)
      .getRawMany();

    return stats.map(s => ({
      date: s.date,
      calls: parseInt(s.calls),
      cost: Math.round((parseFloat(s.cost || 0)) / 100),
      successCalls: parseInt(s.successCalls),
      failCalls: parseInt(s.failCalls),
    }));
  }

  // 获取AI调用日志
  async getAILogs(query: { page?: number; limit?: number; userId?: string; startDate?: string; endDate?: string }) {
    const { page = 1, limit = 20, userId, startDate, endDate } = query;
    
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (startDate && endDate) {
      // 将日期字符串解析为北京时间范围
      const start = new Date(`${startDate}T00:00:00.000+08:00`);
      const end = new Date(`${endDate}T23:59:59.999+08:00`);
      where.createdAt = Between(start, end);
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
        type: f.type,
        content: f.content,
        contactInfo: f.contactInfo,
        status: f.status,
        adminReply: f.adminReply,
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

  // ==================== 按日期查询活跃用户 ====================

  async getActiveUsersByDate(date: string, page = 1, limit = 20) {
    // 查询指定日期有饮食记录的用户，使用 record_date 字段
    const userRecords = await this.dietRecordRepo
      .createQueryBuilder('record')
      .select('record.user_id', 'userId')
      .addSelect('COUNT(record.id)', 'recordCount')
      .where('record.record_date = :date', { date })
      .groupBy('record.user_id')
      .orderBy('recordCount', 'DESC')
      .getRawMany();

    const userIds = userRecords.map(r => r.userId);
    const total = userIds.length;

    if (total === 0) {
      return { total: 0, page, limit, items: [] };
    }

    // 分页查询用户详情
    const paginatedIds = userIds.slice((page - 1) * limit, page * limit);
    
    const users = await this.userRepo.find({
      where: { id: In(paginatedIds) },
      select: ['id', 'phone', 'nickname', 'avatarEmoji', 'createdAt', 'lastLoginAt'],
    });

    // 构建用户ID到记录数的映射
    const recordCountMap = new Map(userRecords.map(r => [r.userId, parseInt(r.recordCount)]));

    // 按原来的顺序排列用户
    const items = paginatedIds.map(userId => {
      const user = users.find(u => u.id === userId);
      return {
        id: user?.id || userId,
        phone: user?.phone || '-',
        nickname: user?.nickname || '未知用户',
        avatarEmoji: user?.avatarEmoji || '👤',
        createdAt: user?.createdAt,
        lastLoginAt: user?.lastLoginAt,
        todayRecords: recordCountMap.get(userId) || 0,
      };
    });

    return { total, page, limit, items };
  }

  // ==================== 饮食记录管理 ====================

  async getRecords(query: {
    userKeyword?: string;
    startDate?: string;
    endDate?: string;
    mealType?: string;
    inputMethod?: string;
    page?: number;
    limit?: number;
  }) {
    const { userKeyword, startDate, endDate, mealType, inputMethod, page = 1, limit = 20 } = query;

    // 先查询用户条件
    let userIds: string[] | undefined;
    if (userKeyword) {
      const users = await this.userRepo.find({
        where: [
          { phone: Like(`%${userKeyword}%`) },
          { nickname: Like(`%${userKeyword}%`) },
        ],
        select: ['id'],
      });
      userIds = users.map(u => u.id);
      if (userIds.length === 0) {
        return { total: 0, page, limit, items: [] };
      }
    }

    // 构建查询条件
    const where: any = {};
    if (userIds) {
      where.userId = In(userIds);
    }
    if (startDate && endDate) {
      where.recordDate = Between(startDate, endDate);
    }
    if (mealType) {
      where.mealType = mealType;
    }
    if (inputMethod) {
      where.inputMethod = inputMethod;
    }

    const [records, total] = await this.dietRecordRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['items'],
    });

    // 获取用户信息
    const recordUserIds = [...new Set(records.map(r => r.userId))];
    const users = await this.userRepo.find({
      where: { id: In(recordUserIds) },
      select: ['id', 'phone', 'nickname', 'avatarEmoji'],
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const items = records.map(record => {
      const user = userMap.get(record.userId);
      return {
        ...record,
        userPhone: user?.phone,
        userNickname: user?.nickname,
        userAvatar: user?.avatarEmoji,
      };
    });

    return { total, page, limit, items };
  }

  async getRecordStats(query?: { startDate?: string; endDate?: string; mealType?: string; inputMethod?: string }) {
    const startDate = query?.startDate || new Date().toISOString().split('T')[0];
    const endDate = query?.endDate || startDate;

    // 使用 QueryBuilder 统一查询
    const qb = this.dietRecordRepo.createQueryBuilder('record');
    
    // 基础条件：record_date 范围
    qb.where('record.record_date >= :startDate', { startDate })
      .andWhere('record.record_date <= :endDate', { endDate });
    
    // 餐次条件
    if (query?.mealType) {
      qb.andWhere('record.meal_type = :mealType', { mealType: query.mealType });
    }
    
    // 录入方式条件
    if (query?.inputMethod) {
      qb.andWhere('record.input_method = :inputMethod', { inputMethod: query.inputMethod });
    }

    // 复制查询条件用于不同统计
    const baseQb = qb.clone();

    // 记录总数
    const totalResult = await baseQb.clone().select('COUNT(*)', 'count').getRawOne();
    const total = parseInt(totalResult?.count || '0');

    // 总热量
    const caloriesResult = await baseQb.clone()
      .select('SUM(record.total_calories)', 'total')
      .getRawOne();
    const totalCalories = Math.round(parseFloat(caloriesResult?.total || '0'));

    // 拍照识别数量
    const photoQb = qb.clone().andWhere('record.input_method = :photo', { photo: 'photo' });
    const photoResult = await photoQb.select('COUNT(*)', 'count').getRawOne();
    const photoCount = parseInt(photoResult?.count || '0');

    // 语音/手动输入数量
    const manualQb = qb.clone().andWhere('record.input_method IN (:...manualMethods)', { 
      manualMethods: ['voice', 'manual'] 
    });
    const manualResult = await manualQb.select('COUNT(*)', 'count').getRawOne();
    const manualCount = parseInt(manualResult?.count || '0');

    return { total, totalCalories, photoCount, manualCount };
  }

  async deleteRecord(id: string) {
    const record = await this.dietRecordRepo.findOne({ 
      where: { id },
      relations: ['items'],
    });
    if (!record) {
      throw new NotFoundException('记录不存在');
    }

    // 删除记录项
    if (record.items && record.items.length > 0) {
      await this.dietRecordItemRepo.remove(record.items);
    }

    // 删除记录
    await this.dietRecordRepo.remove(record);
    return { success: true };
  }
}
