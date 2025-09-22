const { 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  format, 
  isWithinInterval,
  parseISO,
  isValid
} = require('date-fns');

class DateUtils {
  static getNextWeekRange() {
    const today = new Date();
    const nextWeek = addWeeks(today, 1);
    const startOfNextWeek = startOfWeek(nextWeek, { weekStartsOn: 1 }); // 周一开始
    const endOfNextWeek = endOfWeek(nextWeek, { weekStartsOn: 1 }); // 周日结束
    
    return {
      start: startOfNextWeek,
      end: endOfNextWeek,
      identifier: format(startOfNextWeek, 'yyyy-MM-dd') // 用于数据库标识
    };
  }

  static formatDateRange(startDate, endDate) {
    const startStr = format(startDate, 'M.dd');
    const endStr = format(endDate, 'M.dd');
    return `${startStr}-${endStr}`;
  }

  static isEventInNextWeek(eventDate) {
    try {
      const { start, end } = this.getNextWeekRange();
      let parsedDate;
      
      if (typeof eventDate === 'string') {
        parsedDate = parseISO(eventDate);
      } else {
        parsedDate = eventDate;
      }
      
      if (!isValid(parsedDate)) {
        console.warn(`Invalid date: ${eventDate}`);
        return false;
      }
      
      return isWithinInterval(parsedDate, { start, end });
    } catch (error) {
      console.error('Error checking if event is in next week:', error);
      return false;
    }
  }

  static parseEventDate(dateString, timeString = '') {
    try {
      // 常见日期格式解析
      const formats = [
        // ISO format
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        // MM/DD/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        // Month DD, YYYY
        /^(\w+)\s+(\d{1,2}),\s+(\d{4})/,
        // DD-MM-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})/,
      ];

      // 直接尝试解析ISO格式
      let parsedDate = parseISO(dateString);
      if (isValid(parsedDate)) {
        return parsedDate;
      }

      // 尝试其他格式
      const cleanDateString = dateString.trim().replace(/\s+/g, ' ');
      
      // MM/DD/YYYY 格式
      if (formats[1].test(cleanDateString)) {
        parsedDate = new Date(cleanDateString);
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      }

      // Month DD, YYYY 格式
      if (formats[2].test(cleanDateString)) {
        parsedDate = new Date(cleanDateString);
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      }

      console.warn(`Unable to parse date: ${dateString}`);
      return null;
    } catch (error) {
      console.error(`Error parsing date ${dateString}:`, error);
      return null;
    }
  }

  static normalizeEventTime(timeString) {
    if (!timeString) return '';
    
    try {
      // 移除多余空格和特殊字符
      const cleaned = timeString.trim().replace(/\s+/g, ' ');
      
      // 常见时间格式标准化
      const timePatterns = [
        // 12小时制
        { pattern: /(\d{1,2}):?(\d{2})?\s*(am|pm)/gi, format: '$1:$2 $3' },
        // 24小时制
        { pattern: /(\d{1,2}):(\d{2})/, format: '$1:$2' },
        // 只有小时
        { pattern: /^(\d{1,2})\s*(am|pm)$/gi, format: '$1:00 $2' }
      ];
      
      for (const { pattern, format } of timePatterns) {
        if (pattern.test(cleaned)) {
          return cleaned.replace(pattern, format).toLowerCase();
        }
      }
      
      return cleaned;
    } catch (error) {
      console.error(`Error normalizing time ${timeString}:`, error);
      return timeString;
    }
  }

  static isEventStale(eventDate) {
    try {
      const today = new Date();
      let parsedDate;
      
      if (typeof eventDate === 'string') {
        parsedDate = this.parseEventDate(eventDate);
      } else {
        parsedDate = eventDate;
      }
      
      if (!parsedDate || !isValid(parsedDate)) {
        return true; // 无法解析的日期视为过期
      }
      
      // 如果活动时间早于今天，视为过期
      return parsedDate < today;
    } catch (error) {
      console.error('Error checking if event is stale:', error);
      return true;
    }
  }

  static getCurrentWeekIdentifier() {
    const today = new Date();
    const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
    return format(startOfThisWeek, 'yyyy-MM-dd');
  }
}

module.exports = DateUtils;