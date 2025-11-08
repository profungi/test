/**
 * 通用工具函数
 * 用于替代各个模块中重复的工具函数
 */

const config = require('../config');

class CommonHelpers {
  /**
   * 延迟函数 - 用于API调用限流等场景
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检测地理位置类别
   * @param {string} location - 位置字符串
   * @returns {string} - 位置类别 ('sanfrancisco'|'southbay'|'peninsula'|'eastbay'|'northbay'|'other')
   */
  static detectLocationCategory(location) {
    if (!location) return null;

    const locationLower = location.toLowerCase();

    if (config.locations.sanfrancisco.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'sanfrancisco';
    } else if (config.locations.southbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'southbay';
    } else if (config.locations.peninsula.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'peninsula';
    } else if (config.locations.eastbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'eastbay';
    } else if (config.locations.northbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'northbay';
    }

    return 'other';
  }

  /**
   * 获取位置标签用于URL shortener等场景
   * @param {string} location - 位置字符串
   * @returns {string} - 位置标签
   */
  static getLocationTag(location) {
    if (!location) return 'bayarea';

    const locationLower = location.toLowerCase();

    // 检查是否包含旧金山
    if (config.locations.sanfrancisco.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'sf';
    }

    // 检查是否包含南湾城市
    if (config.locations.southbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'southbay';
    }

    // 检查是否包含半岛城市
    if (config.locations.peninsula.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'peninsula';
    }

    // 检查是否包含东湾城市
    if (config.locations.eastbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'eastbay';
    }

    // 检查是否包含北湾城市
    if (config.locations.northbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'northbay';
    }

    // 默认返回 bayarea
    return 'bayarea';
  }

  /**
   * 自动分类价格
   * @param {string} price - 价格字符串
   * @returns {string} - 价格类别 ('free'|'paid'|'expensive'|'unknown')
   */
  static categorizePriceAuto(price) {
    if (!price || price.toLowerCase().includes('free')) {
      return 'free';
    }

    const dollarMatch = price.match(/\$(\d+)/);
    if (dollarMatch) {
      const amount = parseInt(dollarMatch[1]);
      if (amount <= 50) {
        return 'paid';
      } else {
        return 'expensive';
      }
    }

    return 'unknown';
  }

  /**
   * 获取价格分布统计
   * @param {Array} events - 活动数组
   * @returns {Object} - {free: number, paid: number, expensive: number}
   */
  static getPriceDistribution(events) {
    const distribution = {
      free: 0,
      paid: 0,
      expensive: 0
    };

    events.forEach(event => {
      const category = this.categorizePriceAuto(event.price);
      if (category === 'free') {
        distribution.free++;
      } else if (category === 'paid') {
        distribution.paid++;
      } else if (category === 'expensive') {
        distribution.expensive++;
      }
    });

    return distribution;
  }

  /**
   * 判断是否为周末
   * @param {string} timeStr - 时间字符串
   * @returns {boolean}
   */
  static isWeekend(timeStr) {
    if (!timeStr) return false;
    const weekendPattern = /(saturday|sunday)/i;
    return weekendPattern.test(timeStr);
  }

  /**
   * 判断是否免费
   * @param {string} price - 价格字符串
   * @returns {boolean}
   */
  static isFree(price) {
    if (!price) return true;
    return price.toLowerCase().includes('free');
  }

  /**
   * URL验证
   * @param {string} url - URL字符串
   * @returns {boolean}
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取活动类型统计
   * @param {Array} events - 活动数组
   * @returns {Object} - {eventType: count}
   */
  static getEventTypeStats(events) {
    const stats = {};
    events.forEach(event => {
      // 支持两种命名方式: event_type 和 eventType
      const type = event.event_type || event.eventType || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }

  /**
   * 获取优先级统计
   * @param {Array} events - 活动数组
   * @returns {Object} - {priority: count}
   */
  static getPriorityStats(events) {
    const stats = {};
    events.forEach(event => {
      const priority = event.priority || 0;
      stats[priority] = (stats[priority] || 0) + 1;
    });
    return stats;
  }

  /**
   * 按日期分组活动
   * @param {Array} events - 活动数组
   * @returns {Object} - {date: [events]}
   */
  static getEventsByDay(events) {
    const byDay = {};
    events.forEach(event => {
      if (event.start_time) {
        const date = event.start_time.split('T')[0];
        if (!byDay[date]) {
          byDay[date] = [];
        }
        byDay[date].push(event);
      }
    });
    return byDay;
  }

  /**
   * 格式化活动时间显示
   * @param {string} startTime - 开始时间
   * @param {string} endTime - 结束时间
   * @returns {string} - 格式化后的时间字符串
   */
  static formatEventTime(startTime, endTime = null) {
    if (!startTime) return '';

    // 简单格式化，可以根据需要扩展
    const start = new Date(startTime);
    const timeStr = start.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (endTime) {
      const end = new Date(endTime);
      const endTimeStr = end.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${timeStr} - ${endTimeStr}`;
    }

    return timeStr;
  }
}

module.exports = CommonHelpers;
