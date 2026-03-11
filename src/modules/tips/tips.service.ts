import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTip, ColorTheme } from './entities/user-tip.entity';
import { CreateTipDto, UpdateTipDto } from './dto/tips.dto';

@Injectable()
export class TipsService {
  constructor(
    @InjectRepository(UserTip)
    private readonly tipRepo: Repository<UserTip>,
  ) {}

  // 获取所有提示
  async getAll(userId: string) {
    const tips = await this.tipRepo.find({
      where: { userId },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    return tips;
  }

  // 加权随机获取一条提示
  async getRandom(userId: string) {
    const tips = await this.tipRepo.find({
      where: { userId, isActive: true },
    });

    if (tips.length === 0) {
      return null;
    }

    // 加权随机选择
    const totalWeight = tips.reduce((sum, tip) => sum + tip.displayWeight, 0);
    let random = Math.random() * totalWeight;

    for (const tip of tips) {
      random -= tip.displayWeight;
      if (random <= 0) {
        return tip;
      }
    }

    return tips[0];
  }

  // 创建提示
  async create(userId: string, dto: CreateTipDto) {
    const tip = this.tipRepo.create({
      userId,
      content: dto.content,
      colorTheme: dto.colorTheme || ColorTheme.GREEN,
      displayWeight: dto.displayWeight || 1,
      sortOrder: dto.sortOrder || 0,
    });

    return this.tipRepo.save(tip);
  }

  // 更新提示
  async update(userId: string, id: string, dto: UpdateTipDto) {
    const tip = await this.tipRepo.findOne({ where: { id } });

    if (!tip) {
      throw new NotFoundException('提示不存在');
    }

    if (tip.userId !== userId) {
      throw new ForbiddenException('无权修改此提示');
    }

    Object.assign(tip, dto);
    return this.tipRepo.save(tip);
  }

  // 删除提示
  async delete(userId: string, id: string) {
    const tip = await this.tipRepo.findOne({ where: { id } });

    if (!tip) {
      throw new NotFoundException('提示不存在');
    }

    if (tip.userId !== userId) {
      throw new ForbiddenException('无权删除此提示');
    }

    await this.tipRepo.softDelete(id);
  }

  // 检查用户是否有自定义提示
  async hasCustomTips(userId: string): Promise<boolean> {
    const count = await this.tipRepo.count({
      where: { userId, isActive: true },
    });
    return count > 0;
  }
}
