/**
 * 时间工具函数 - 统一处理北京时间（东八区）
 */

/**
 * 将 Date 对象格式化为北京时间字符串
 * @param date Date 对象或 ISO 字符串
 * @param format 格式类型，默认为 'datetime'
 * @returns 北京时间字符串
 */
export function formatToBeijingTime(
  date: Date | string | null | undefined,
  format: 'datetime' | 'date' | 'time' = 'datetime',
): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  // 使用东八区时区格式化
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: format !== 'date' ? '2-digit' : undefined,
    minute: format !== 'date' ? '2-digit' : undefined,
    second: format !== 'date' ? '2-digit' : undefined,
    hour12: false,
    timeZone: 'Asia/Shanghai',
  };

  const parts = new Intl.DateTimeFormat('zh-CN', options).formatToParts(d);
  const partMap = new Map(parts.map((p) => [p.type, p.value]));

  const year = partMap.get('year');
  const month = partMap.get('month');
  const day = partMap.get('day');
  const hour = partMap.get('hour');
  const minute = partMap.get('minute');
  const second = partMap.get('second');

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hour}:${minute}:${second}`;
    case 'datetime':
    default:
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}

/**
 * 获取当前北京时间的 Date 对象（实际还是 UTC，只是时间戳对应北京时间）
 */
export function getBeijingNow(): Date {
  const now = new Date();
  // 获取北京时间的时间戳偏移
  const offset = now.getTimezoneOffset() + 480; // 480 分钟 = 8 小时
  return new Date(now.getTime() + offset * 60 * 1000);
}

/**
 * 获取今日北京时间的起止时间（用于数据库查询）
 */
export function getBeijingTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  // 格式化为北京时间日期字符串
  const beijingDate = formatToBeijingTime(now, 'date');

  return {
    start: new Date(`${beijingDate}T00:00:00.000+08:00`),
    end: new Date(`${beijingDate}T23:59:59.999+08:00`),
  };
}

/**
 * 获取指定天数前北京时间的起始时间
 */
export function getBeijingDateRange(daysAgo: number): { start: Date; end: Date } {
  const now = new Date();
  const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const date = new Date(beijingNow);
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0];

  return {
    start: new Date(`${dateStr}T00:00:00.000+08:00`),
    end: new Date(`${dateStr}T23:59:59.999+08:00`),
  };
}
