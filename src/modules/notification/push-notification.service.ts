import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { NotificationSetting } from './entities/notification-setting.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

// Expo Push API 响应类型
interface ExpoPushTicket {
  id?: string;
  status?: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly expoPushApiUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(
    @InjectRepository(NotificationSetting)
    private readonly settingRepo: Repository<NotificationSetting>,
  ) {}

  /**
   * 每分钟检查一次需要发送的提醒
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendNotifications() {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const currentTime = this.formatTime(beijingTime);
    const currentMinute = beijingTime.getMinutes();

    // 只在整点检查（00分），避免每分钟都检查
    if (currentMinute !== 0) {
      return;
    }

    this.logger.debug(`检查 ${currentTime} 的提醒...`);

    try {
      // 获取所有开启了总开关的设置
      const settings = await this.settingRepo.find({
        where: { masterEnabled: true },
      });

      for (const setting of settings) {
        await this.checkUserNotifications(setting, currentTime);
      }
    } catch (error) {
      this.logger.error('检查通知失败:', error);
    }
  }

  /**
   * 检查单个用户的通知设置
   */
  private async checkUserNotifications(
    setting: NotificationSetting,
    currentTime: string,
  ) {
    // 检查早餐提醒
    if (setting.breakfastEnabled && setting.breakfastTime === currentTime) {
      await this.sendNotification(
        setting.expoPushToken,
        '🍳 早餐提醒',
        '该吃早餐啦！记得记录今天的饮食哦~',
      );
    }

    // 检查午餐提醒
    if (setting.lunchEnabled && setting.lunchTime === currentTime) {
      await this.sendNotification(
        setting.expoPushToken,
        '🍱 午餐提醒',
        '午餐时间到！注意饮食均衡，多吃蔬菜~',
      );
    }

    // 检查晚餐提醒
    if (setting.dinnerEnabled && setting.dinnerTime === currentTime) {
      await this.sendNotification(
        setting.expoPushToken,
        '🌙 晚餐提醒',
        '该吃晚餐啦！晚上不要吃太饱哦~',
      );
    }

    // 检查睡前提醒
    if (setting.bedtimeRemind && setting.bedtimeTime === currentTime) {
      await this.sendNotification(
        setting.expoPushToken,
        '😴 睡前提醒',
        '准备休息了吗？记得复盘今天的饮食记录~',
      );
    }

    // 检查饮水提醒（更复杂的逻辑，需要检查间隔）
    if (setting.waterEnabled) {
      await this.checkWaterReminder(setting, currentTime);
    }
  }

  /**
   * 检查饮水提醒
   * 简单的实现：在设置的时间范围内，每隔指定小时提醒一次
   */
  private async checkWaterReminder(
    setting: NotificationSetting,
    currentTime: string,
  ) {
    // 检查是否在运行时间内
    if (
      currentTime >= setting.waterStartTime &&
      currentTime <= setting.waterEndTime
    ) {
      // 计算当前时间是否在提醒间隔上
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const [startHour] = setting.waterStartTime.split(':').map(Number);
      const interval = setting.waterIntervalH;

      // 从开始时间起，每隔interval小时提醒一次
      const hoursSinceStart = currentHour - startHour;
      if (hoursSinceStart >= 0 && hoursSinceStart % interval === 0 && currentMin === 0) {
        await this.sendNotification(
          setting.expoPushToken,
          '💧 饮水提醒',
          '该喝水啦！保持身体水分充足很重要~',
        );
      }
    }
  }

  /**
   * 发送推送通知
   */
  private async sendNotification(
    pushToken: string | null,
    title: string,
    body: string,
  ) {
    if (!pushToken) {
      this.logger.warn(`用户没有 Push Token，无法发送通知`);
      return;
    }

    // 检查是否是有效的 Expo Push Token
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      this.logger.warn(`无效的 Push Token: ${pushToken.substring(0, 20)}...`);
      return;
    }

    try {
      const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: { type: 'reminder' },
        priority: 'high',
        channelId: 'default',
      };

      const response = await fetch(this.expoPushApiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`发送通知失败: ${response.status} ${errorText}`);
        return;
      }

      const result: ExpoPushTicket = await response.json();

      if (result.status === 'error') {
        this.logger.error(`发送通知失败: ${result.message}`);
        // 如果是无效令牌，可以考虑从数据库中删除
        if (result.details?.error === 'DeviceNotRegistered') {
          await this.removeInvalidToken(pushToken);
        }
      } else {
        this.logger.log(`通知发送成功: ${title} -> ${pushToken.substring(0, 20)}...`);
      }
    } catch (error) {
      this.logger.error('发送通知异常:', error);
    }
  }

  /**
   * 删除无效的 Push Token
   */
  private async removeInvalidToken(pushToken: string) {
    try {
      const setting = await this.settingRepo.findOne({
        where: { expoPushToken: pushToken },
      });
      if (setting) {
        setting.expoPushToken = null;
        await this.settingRepo.save(setting);
        this.logger.log(`已删除无效的 Push Token: ${pushToken.substring(0, 20)}...`);
      }
    } catch (error) {
      this.logger.error('删除无效 Token 失败:', error);
    }
  }

  /**
   * 格式化时间为 HH:MM
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 手动触发测试通知（用于调试）
   */
  async sendTestNotification(userId: string) {
    const setting = await this.settingRepo.findOne({ where: { userId } });
    if (!setting || !setting.expoPushToken) {
      throw new Error('用户没有注册 Push Token');
    }

    await this.sendNotification(
      setting.expoPushToken,
      '🧪 测试通知',
      '这是一条测试通知，如果您收到说明推送功能正常！',
    );

    return { success: true };
  }
}
