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
  getNextWeekRange() {
    const today = new Date();
    const nextMonday = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
    const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 });
    
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
      price: this.cleanText(rawEvent.price) || 'Free',
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

  // 发起HTTP请求
  async fetchPage(url) {
    try {
      await this.delay();
      console.log(`Fetching: ${url}`);
      
      const response = await this.axiosInstance.get(url);
      return cheerio.load(response.data);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error.message);
      throw error;
    }
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