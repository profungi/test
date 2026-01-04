/**
 * San Jose Downtown API Scraper
 * 使用 The Events Calendar REST API 获取 San Jose Downtown 的活动
 */

const RestApiScraper = require('./rest-api-scraper');

class SJDowntownApiScraper extends RestApiScraper {
  constructor(sourceConfig) {
    super(sourceConfig);
  }

  /**
   * 将 The Events Calendar API 的事件数据转换为标准格式
   */
  transformEvent(apiEvent) {
    // 提取地点信息
    const location = this.extractLocation(apiEvent);

    // 清理和截断描述
    const description = this.truncateDescription(apiEvent.description, 500);

    // 解析开始和结束时间
    const startDate = apiEvent.start_date; // "2026-01-03 08:00:00"
    const endDate = apiEvent.end_date;

    // 构建事件对象（使用驼峰命名以匹配 database.js）
    const event = {
      title: this.stripHtml(apiEvent.title),
      startTime: startDate, // "YYYY-MM-DD HH:MM:SS"
      endTime: endDate || null,
      location: location,
      originalUrl: apiEvent.url,
      description: description,
      source: this.config.displayName,
      scraped_at: new Date().toISOString()
    };

    // 可选字段
    if (apiEvent.cost) {
      event.price = apiEvent.cost;
    }

    if (apiEvent.image && apiEvent.image.url) {
      event.image_url = apiEvent.image.url;
    }

    if (apiEvent.categories && apiEvent.categories.length > 0) {
      event.categories = apiEvent.categories.map(cat => cat.name).join(', ');
    }

    return event;
  }

  /**
   * 构建时间字符串
   */
  buildTimeString(apiEvent) {
    const startDate = apiEvent.start_date; // 格式: "2026-01-03 08:00:00"
    const endDate = apiEvent.end_date;
    const isAllDay = apiEvent.all_day;

    if (!startDate) {
      return null;
    }

    // 解析开始和结束日期
    const start = this.parseEventDate(startDate);
    const end = endDate ? this.parseEventDate(endDate) : null;

    if (!start) {
      return null;
    }

    // 格式化时间字符串
    if (isAllDay) {
      // 全天活动
      if (end && end.date !== start.date) {
        return `${start.date} - ${end.date} (All Day)`;
      } else {
        return `${start.date} (All Day)`;
      }
    } else {
      // 有具体时间的活动
      if (end) {
        if (end.date !== start.date) {
          // 跨天活动
          return `${start.date} ${start.time} - ${end.date} ${end.time}`;
        } else {
          // 同一天
          return `${start.date} ${start.time} - ${end.time}`;
        }
      } else {
        return `${start.date} ${start.time}`;
      }
    }
  }

  /**
   * 解析事件日期字符串
   * 输入: "2026-01-03 08:00:00"
   * 输出: { date: "January 3, 2026", time: "8:00 AM", datetime: Date object }
   */
  parseEventDate(dateStr) {
    if (!dateStr) return null;

    try {
      const parts = dateStr.split(' ');
      if (parts.length < 2) return null;

      const datePart = parts[0]; // "2026-01-03"
      const timePart = parts[1]; // "08:00:00"

      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');

      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));

      // 格式化日期
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

      // 格式化时间 (12小时制)
      let hourNum = dateObj.getHours();
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      hourNum = hourNum % 12;
      hourNum = hourNum ? hourNum : 12; // 0 点显示为 12
      const formattedTime = `${hourNum}:${String(dateObj.getMinutes()).padStart(2, '0')} ${ampm}`;

      return {
        date: formattedDate,
        time: formattedTime,
        datetime: dateObj
      };
    } catch (error) {
      console.error(`Error parsing date: ${dateStr}`, error);
      return null;
    }
  }

  /**
   * 提取地点信息
   */
  extractLocation(apiEvent) {
    if (!apiEvent.venue) {
      return 'San Jose, CA';
    }

    const venue = apiEvent.venue;
    const parts = [];

    // 场馆名称
    if (venue.venue) {
      parts.push(venue.venue);
    }

    // 地址
    if (venue.address) {
      parts.push(venue.address);
    }

    // 城市
    if (venue.city) {
      parts.push(venue.city);
    } else {
      parts.push('San Jose'); // 默认城市
    }

    // 州
    if (venue.state) {
      parts.push(venue.state);
    } else {
      parts.push('CA'); // 默认州
    }

    return parts.join(', ');
  }

  /**
   * 验证事件（额外的验证逻辑）
   */
  validateEvent(event) {
    // 调用父类的基本验证
    if (!super.validateEvent(event)) {
      return false;
    }

    // 过滤掉一些无效的事件标题
    const invalidTitles = [
      'Whats going on',
      'What\'s going on',
      'Events Search',
      'Search and Views Navigation',
      'Navigation',
      'Make Your Plans'
    ];

    const titleLower = event.title.toLowerCase();
    if (invalidTitles.some(invalid => titleLower.includes(invalid.toLowerCase()))) {
      return false;
    }

    // 过滤掉固定装置（非活动）
    if (titleLower.includes('sonic runway')) {
      return false;
    }

    return true;
  }
}

module.exports = SJDowntownApiScraper;
