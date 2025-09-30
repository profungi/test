const axios = require('axios');
const cheerio = require('cheerio');
const { addDays, startOfWeek, endOfWeek, format, parseISO, isWithinInterval } = require('date-fns');
const config = require('../config');

class BaseScraper {
  constructor(sourceName) {
    this.sourceName = sourceName;
    this.sourceConfig = config.eventSources.find(s => s.name === sourceName);
    if (!this.sourceConfig) {
      throw new Error(`No configuration found for source: ${sourceName}`);
    }
    
    this.axiosInstance = axios.create({
      timeout: config.scraping.timeout,
      headers: {
        'User-Agent': config.scraping.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
  }

  // 获取下周的时间范围 (周一到周日)
  // 基准时间为当前抓取时间
  getNextWeekRange() {
    const today = new Date();
    console.log(`[Time Range] Today is: ${format(today, 'yyyy-MM-dd (EEEE)')}`);

    // 找到本周的周一
    const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
    console.log(`[Time Range] This week Monday: ${format(thisWeekMonday, 'yyyy-MM-dd')}`);

    // 加7天得到下周一
    const nextMonday = addDays(thisWeekMonday, 7);
    const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 });

    console.log(`[Time Range] Next week range: ${format(nextMonday, 'yyyy-MM-dd')} to ${format(nextSunday, 'yyyy-MM-dd')}`);

    return {
      start: nextMonday,
      end: nextSunday,
      identifier: format(nextMonday, 'yyyy-MM-dd') + '_to_' + format(nextSunday, 'yyyy-MM-dd')
    };
  }

  // 验证事件时间是否在下周范围内
  isValidEventTime(eventTime, weekRange) {
    try {
      const eventDate = typeof eventTime === 'string' ? parseISO(eventTime) : eventTime;
      return isWithinInterval(eventDate, {
        start: weekRange.start,
        end: weekRange.end
      });
    } catch (error) {
      console.warn(`Invalid event time format: ${eventTime}`);
      return false;
    }
  }

  // 规范化活动数据
  normalizeEvent(rawEvent, weekRange) {
    const normalized = {
      title: this.cleanText(rawEvent.title),
      startTime: rawEvent.startTime,
      endTime: rawEvent.endTime || null,
      location: this.cleanText(rawEvent.location),
      price: this.normalizePrice(rawEvent.price, rawEvent.title, rawEvent.description),
      description: this.cleanText(rawEvent.description) || '',
      originalUrl: rawEvent.originalUrl,
      source: this.sourceName,
      eventType: this.detectEventType(rawEvent.title, rawEvent.description),
      scraped_at: new Date().toISOString(),
      weekIdentifier: weekRange.identifier
    };

    // 验证必填字段
    if (!normalized.title || !normalized.startTime || !normalized.location || !normalized.originalUrl) {
      return null;
    }

    // 验证时间范围
    if (!this.isValidEventTime(normalized.startTime, weekRange)) {
      return null;
    }

    return normalized;
  }

  // 规范化价格信息 - 更严格的判断
  normalizePrice(price, title, description) {
    // 如果有明确的价格信息
    if (price) {
      const priceText = this.cleanText(price).toLowerCase();

      // 明确的免费标识
      if (/^(free|$0|no charge|complimentary|free admission|free entry)$/i.test(priceText)) {
        return 'Free';
      }

      // 包含价格数字
      if (/\$\d+|\d+\s*usd|price|ticket|admission/i.test(priceText)) {
        return this.cleanText(price);
      }

      // 其他情况返回原始价格信息
      return this.cleanText(price);
    }

    // 没有价格信息时，从标题和描述中推断
    const combinedText = ((title || '') + ' ' + (description || '')).toLowerCase();

    // 明确提到免费
    if (/\bfree\s+(admission|entry|event|show|concert)\b/i.test(combinedText)) {
      return 'Free';
    }

    // 明确提到价格或票
    if (/ticket|admission|price|\$\d+|\d+\s*usd|pay|cost|donation/i.test(combinedText)) {
      return 'See event page';  // 不确定价格，让用户查看活动页面
    }

    // 默认情况：价格未知
    return 'Check event page';
  }

  // 清理文本内容
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ')
      .trim()
      .substring(0, 500); // 防止过长
  }

  // 检测活动类型
  detectEventType(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    
    const patterns = {
      market: /market|farmer|artisan|craft|vendor/i,
      fair: /fair|expo|bazaar|festival/i,
      festival: /festival|fest|celebration|carnival/i,
      food: /food|dining|restaurant|culinary|wine|beer|taste/i,
      music: /music|concert|band|dj|performance|show/i,
      art: /art|gallery|museum|exhibition|design/i,
      tech: /tech|startup|coding|developer|innovation/i,
      free: /free|no cost|complimentary/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'other';
  }

  // 检查地理位置是否相关
  isRelevantLocation(location) {
    if (!location) return false;
    
    const locationText = location.toLowerCase();
    const allLocations = [
      ...config.locations.primary,
      ...config.locations.secondary,
      ...config.locations.keywords
    ];

    return allLocations.some(loc => 
      locationText.includes(loc.toLowerCase())
    );
  }

  // 添加延迟以避免过于频繁的请求
  async delay(ms = config.scraping.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 发起HTTP请求（带重试机制）
  async fetchPage(url, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.delay();
        console.log(`Fetching: ${url} (attempt ${attempt}/${maxRetries})`);

        const response = await this.axiosInstance.get(url);
        return cheerio.load(response.data);
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed for ${url}: ${error.message}`);

        if (attempt < maxRetries) {
          const backoffDelay = config.scraping.requestDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${backoffDelay}ms...`);
          await this.delay(backoffDelay);
        }
      }
    }

    console.error(`Failed to fetch ${url} after ${maxRetries} attempts`);
    throw lastError;
  }

  // 主要的抓取方法，子类需要实现
  async scrapeEvents() {
    throw new Error('scrapeEvents method must be implemented by subclass');
  }

  // 公共的抓取入口
  async scrape() {
    console.log(`Starting to scrape ${this.sourceName}...`);
    
    try {
      const weekRange = this.getNextWeekRange();
      console.log(`Target week: ${weekRange.identifier}`);
      
      const rawEvents = await this.scrapeEvents(weekRange);
      const normalizedEvents = [];

      for (const rawEvent of rawEvents) {
        const normalized = this.normalizeEvent(rawEvent, weekRange);
        if (normalized && this.isRelevantLocation(normalized.location)) {
          normalizedEvents.push(normalized);
        }
      }

      console.log(`${this.sourceName}: Found ${normalizedEvents.length} valid events`);
      return normalizedEvents.slice(0, config.scraping.maxEventsPerSource);
      
    } catch (error) {
      console.error(`Error scraping ${this.sourceName}:`, error.message);
      return [];
    }
  }
}

module.exports = BaseScraper;