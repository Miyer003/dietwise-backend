import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSetting } from './entities/notification-setting.entity';
import { UpdateNotificationSettingsDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationSetting)
    private readonly settingRepo: Repository<NotificationSetting>,
  ) {}

  // 获取设置
  async getSettings(userId: string) {
    let settings = await this.settingRepo.findOne({
      where: { userId },
    });

    if (!settings) {
      // 创建默认设置
      settings = this.settingRepo.create({
        userId,
      });
      await this.settingRepo.save(settings);
    }

    return settings;
  }

  // 更新设置
  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    let settings = await this.settingRepo.findOne({ where: { userId } });

    if (!settings) {
      settings = this.settingRepo.create({ userId });
    }

    Object.assign(settings, dto);
    settings.updatedAt = new Date();

    return this.settingRepo.save(settings);
  }

  // 保存推送Token
  async savePushToken(userId: string, token: string) {
    let settings = await this.settingRepo.findOne({ where: { userId } });

    if (!settings) {
      settings = this.settingRepo.create({ userId });
    }

    settings.expoPushToken = token;
    settings.updatedAt = new Date();

    return this.settingRepo.save(settings);
  }
}
