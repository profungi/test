/**
 * 时间处理工具类
 * 核心原则：
 * 1. 精准优先 - 必须有明确的小时和分钟
 * 2. 精确到分钟 - 统一格式 YYYY-MM-DDTHH:MM
 * 3. 时区正确 - 确保是PST/PDT本地时间
 */

class TimeHandler {
  /**
   * 规范化时间字符串
   * @param {string} timeStr - 原始时间字符串
   * @param {Object} options - 配置选项
   * @returns {string|null} - 规范化后的时间 (YYYY-MM-DDTHH:MM) 或 null
   */
  static normalize(timeStr, options = {}) {
    if (!timeStr) return null;

    const { source = 'unknown', allowTextParsing = false } = options;

    // 步骤1: 验证时区（如果有）
    // 支持两种格式：-07:00 (有冒号) 和 -0700 (无冒号)
    const timezoneMatch = timeStr.match(/([+-]\d{2}:?\d{2}|Z)$/);
    if (timezoneMatch) {
      const timezone = timezoneMatch[1];

      // 验证是否为旧金山时区 (PST: -08:00/-0800, PDT: -07:00/-0700)
      if (timezone !== '-07:00' && timezone !== '-0700' &&
          timezone !== '-08:00' && timezone !== '-0800') {
        if (timezone === 'Z') {
          console.warn(`[${source}] UTC timezone detected, may need conversion: ${timeStr}`);
        } else {
          console.warn(`[${source}] Unexpected timezone: ${timeStr}`);
        }
      }
    }

    // 步骤2: 去除时区后缀（支持有冒号和无冒号两种格式）
    let normalized = timeStr.replace(/([+-]\d{2}:?\d{2}|Z)$/, '').trim();

    // 步骤3: 验证和规范化格式

    // 格式1: YYYY-MM-DDTHH:MM:SS (完整)
    const fullMatch = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}):\d{2}$/);
    if (fullMatch) {
      return fullMatch[1]; // 去除秒，返回 YYYY-MM-DDTHH:MM
    }

    // 格式2: YYYY-MM-DDTHH:MM (已经是目标格式)
    if (normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      return normalized;
    }

    // 格式3: YYYY-MM-DD (仅日期) - 不接受
    if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log(`[${source}] Date only, no time: ${timeStr}`);
      return null; // 明确返回null，不猜测时间
    }

    // 其他格式 - 无效
    console.warn(`[${source}] Invalid time format: "${timeStr}" -> normalized: "${normalized}" (length: ${normalized.length})`);
    return null;
  }

  /**
   * 从文本中解析时间（如 "7:00 PM" 或 "7pm"）
   * @param {string} dateStr - 日期字符串 (YYYY-MM-DD)
   * @param {string} timeText - 时间文本
   * @returns {string|null} - YYYY-MM-DDTHH:MM 或 null
   */
  static parseTimeText(dateStr, timeText) {
    if (!dateStr || !timeText) return null;

    // 清理文本：移除 " / ..." 后面的内容
    // "7pm / Title" → "7pm"
    timeText = timeText.split('/')[0].trim();

    // 提取时间：支持多种格式
    // "7:00 PM", "7:00pm", "7pm", "19:00", "7:30pm"
    const patterns = [
      {
        // 格式1: "7:00 PM" 或 "7:00pm" (有分钟和am/pm)
        regex: /(\d{1,2}):(\d{2})\s*([ap]m)/i,
        parse: (m) => ({
          hour: parseInt(m[1]),
          minute: parseInt(m[2]),
          period: m[3]
        })
      },
      {
        // 格式2: "7pm" 或 "7 pm" (只有小时和am/pm)
        regex: /(\d{1,2})\s*([ap]m)/i,
        parse: (m) => ({
          hour: parseInt(m[1]),
          minute: 0,
          period: m[2]
        })
      },
      {
        // 格式3: "19:00" (24小时制)
        regex: /(\d{1,2}):(\d{2})$/,
        parse: (m) => ({
          hour: parseInt(m[1]),
          minute: parseInt(m[2]),
          period: null
        })
      }
    ];

    for (const pattern of patterns) {
      const match = timeText.match(pattern.regex);
      if (match) {
        const { hour: rawHour, minute, period } = pattern.parse(match);
        let hour = rawHour;

        // 转换为24小时制
        if (period) {
          const isPM = period.toLowerCase() === 'pm';
          if (isPM && hour !== 12) {
            hour += 12;
          } else if (!isPM && hour === 12) {
            hour = 0;
          }
        }

        // 验证日期格式
        if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          console.warn(`Invalid date format: ${dateStr}`);
          return null;
        }

        // 构建时间字符串
        const hourStr = hour.toString().padStart(2, '0');
        const minStr = minute.toString().padStart(2, '0');
        const result = `${dateStr}T${hourStr}:${minStr}`;

        // 验证结果
        if (result.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * 解析时间范围文本（如 "12 - 5pm" 或 "2pm - 8pm"）
   * @param {string} dateStr - 日期字符串 (YYYY-MM-DD)
   * @param {string} rangeText - 时间范围文本
   * @returns {Object|null} - { startTime, endTime } 或 null
   */
  static parseTimeRange(dateStr, rangeText) {
    if (!dateStr || !rangeText) return null;

    // 清理文本：移除 " / ..." 后面的内容
    rangeText = rangeText.split('/')[0].trim();

    // 匹配: "12 - 5pm", "2pm - 8pm", "12:30 - 5:00pm", "5pm-10pm" (无空格)
    const rangeMatch = rangeText.match(
      /(\d{1,2})\s*(?::(\d{2}))?\s*([ap]m)?\s*[-–]\s*(\d{1,2})\s*(?::(\d{2}))?\s*([ap]m)/i
    );

    if (!rangeMatch) return null;

    const startHour = parseInt(rangeMatch[1]);
    const startMin = rangeMatch[2] ? parseInt(rangeMatch[2]) : 0;
    const startPeriod = rangeMatch[3] || rangeMatch[6]; // 如果前面没有am/pm，用后面的
    const endHour = parseInt(rangeMatch[4]);
    const endMin = rangeMatch[5] ? parseInt(rangeMatch[5]) : 0;
    const endPeriod = rangeMatch[6];

    // 转换为24小时制
    let start24 = startHour;
    if (startPeriod && startPeriod.toLowerCase() === 'pm' && startHour !== 12) {
      start24 += 12;
    } else if (startPeriod && startPeriod.toLowerCase() === 'am' && startHour === 12) {
      start24 = 0;
    }

    let end24 = endHour;
    if (endPeriod.toLowerCase() === 'pm' && endHour !== 12) {
      end24 += 12;
    } else if (endPeriod.toLowerCase() === 'am' && endHour === 12) {
      end24 = 0;
    }

    // 验证日期格式
    if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return null;
    }

    // 构建时间字符串
    const startTime = `${dateStr}T${start24.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
    const endTime = `${dateStr}T${end24.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

    // 验证格式
    if (startTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) &&
        endTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      return { startTime, endTime };
    }

    return null;
  }

  /**
   * 从datetime字符串中提取日期部分
   * @param {string} datetimeStr - 日期时间字符串
   * @returns {string|null} - YYYY-MM-DD 或 null
   */
  static extractDate(datetimeStr) {
    if (!datetimeStr) return null;

    const match = datetimeStr.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  /**
   * 验证时间字符串格式
   * @param {string} timeStr - 时间字符串
   * @returns {boolean}
   */
  static isValidFormat(timeStr) {
    if (!timeStr) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timeStr);
  }
}

module.exports = TimeHandler;
